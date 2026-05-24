import numpy as np
ref_A = np.load("E:/Kineira/backend/assets/models/ref_A.npy")
ref_B = np.load("E:/Kineira/backend/assets/models/ref_B.npy")
print("A first 10 values:", ref_A[0, :10])
print("B first 10 values:", ref_B[0, :10])
print("Are they equal?", np.array_equal(ref_A, ref_B))