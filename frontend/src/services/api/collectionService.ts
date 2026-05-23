const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

export type AllStatus = Record<
  string,
  {
    videos_collected: number;
    target: number;
    is_collecting?: boolean;
    current_video?: number | null;
    current_frame?: number | null;
  }
>;

export type FrameItem = {
  frame_num: number;
  keypoints: number[];
};

export type BatchSaveResponse = {
  status: string;
  action: string;
  video_num: number;
  frames_saved: number;
  total_nonzero: number;
  total_zeros: number;
  frames: any[];  // metadata từng frame
};

class CollectionService {
  async getAllStatus(): Promise<AllStatus> {
    const res = await fetch(`${API_BASE}/data-collection/status`);
    if (!res.ok) throw new Error(`Failed to load status: ${res.status}`);
    return res.json();
  }

  async startCollection(action: string, videoNum: number) {
    const res = await fetch(`${API_BASE}/data-collection/start/${action}/${videoNum}`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`Failed to start collection: ${res.status}`);
    return res.json();
  }

  // Hàm gửi batch frame
  async saveFrameBatch(
    action: string,
    videoNum: number,
    frames: FrameItem[]
  ): Promise<BatchSaveResponse> {
    const res = await fetch(
      `${API_BASE}/data-collection/frame-vector/${action}/${videoNum}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frames }),
      }
    );

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Batch save failed: ${res.status} ${text}`);
    }

    return res.json();
  }
}

const collectionService = new CollectionService();
export default collectionService;