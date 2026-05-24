import numpy as np
import sys

# Cấu hình NumPy để in ra toàn bộ mảng (không rút gọn)
np.set_printoptions(threshold=sys.maxsize)

# Đọc file (đã sửa đường dẫn)
data = np.load(r'E:\Kineira\backend\datasets\MP_Data\A\10\10.npy')
data2 = np.load(r'E:\Kineira\backend\datasets\MP_Data\A\50\10.npy')

# In ra toàn bộ dữ liệu
print(data)
print(data2)