import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export interface TrainingStatus {
  status: 'idle' | 'queued' | 'training' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  current_epoch: number;
  total_epochs: number;
  loss: number | null;
  accuracy: number | null;
  message: string | null;
  metrics: any | null;
}

export interface TrainingMetrics {
  status: string;
  model_path: string;
  accuracy: number;
  train_samples: number;
  test_samples: number;
  epochs: number;
  loss: number;
  val_loss: number | null;
}

class TrainingService {
  async startTraining() {
    const response = await axios.post(`${API_URL}/training/start`);
    return response.data;
  }

  async getStatus(): Promise<TrainingStatus> {
    const response = await axios.get(`${API_URL}/training/status`);
    return response.data;
  }

  async cancelTraining() {
    const response = await axios.post(`${API_URL}/training/cancel`);
    return response.data;
  }

  async validateData() {
    const response = await axios.post(`${API_URL}/training/validate`);
    return response.data;
  }

  async getMetrics(): Promise<TrainingMetrics> {
    const response = await axios.get(`${API_URL}/training/metrics`);
    return response.data;
  }

  async pollStatus(maxWaitMs: number = 300000): Promise<TrainingStatus> {
    const startTime = Date.now();
    const pollInterval = 1000;

    return new Promise((resolve, reject) => {
      const interval = setInterval(async () => {
        try {
          const status = await this.getStatus();

          if (status.status === 'completed' || status.status === 'failed' || status.status === 'cancelled') {
            clearInterval(interval);
            resolve(status);
          }

          if (Date.now() - startTime > maxWaitMs) {
            clearInterval(interval);
            reject(new Error('Training poll timeout'));
          }
        } catch (error) {
          clearInterval(interval);
          reject(error);
        }
      }, pollInterval);
    });
  }
}

export default new TrainingService();
