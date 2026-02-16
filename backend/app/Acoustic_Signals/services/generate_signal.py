# import numpy as np 
# from app.Acoustic_Signals.schemas.schema import GeneratedSignal
# # 

# def generate_signal(v, fs, duration, num_points_per_second):
#     c = 343   # sound velocity    m/sec
#     x_offset = 2 
#     t = np.linspace(- duration / 2 , duration / 2, num_points_per_second * duration)

#     x = v * t

#     r = np.sqrt(x**2 + x_offset**2)

#     v_radial = v * ( x / r )

#     f_instant = fs * (c / (c + v_radial))


#     phase = 2 * np.pi * np.cumsum(f_instant) / num_points_per_second
#     signal = .5 * np.sin(phase)

#     intensity_relation = 1 / (r**2 + 1)

#     signal *= (intensity_relation/ np.max(intensity_relation))
    
#     signal_int = np.int16(signal * 32767)

#     return GeneratedSignal(Signal = signal_int.tolist(), Time = t)
