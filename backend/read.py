import numpy as np
import sys

# Cấu hình NumPy để in ra toàn bộ mảng (không rút gọn)
np.set_printoptions(threshold=sys.maxsize)

# Đọc file (đã sửa đường dẫn)
data = np.load(r'E:\Kineira\backend\datasets\MP_Data\A\58\20.npy')

# In ra toàn bộ dữ liệu
print(data)
