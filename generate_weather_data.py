import json
import numpy as np
from sharppy.sharptab import profile, params

# Example mock sounding data (you'll replace with real data later)
pres = np.array([1000, 925, 850, 700, 500, 300])
hght = np.array([0, 762, 1456, 3012, 5570, 9880])
tmpc = np.array([25, 20, 15, 0, -20, -50])
dwpc = np.array([20, 18, 10, -5, -25, -55])
wspd = np.array([10, 15, 20, 25, 30, 35])
wdir = np.array([180, 200, 220, 240, 260, 280])

# Create profile and calculate CAPE/SCP
prof = profile.create_profile(profile='convective', pres=pres, hght=hght, tmpc=tmpc, dwpc=dwpc, wspd=wspd, wdir=wdir)
pcls = params.parcelx(prof, flag=1)
cape = pcls.bplus
scp = params.scp(prof.mupcl.bplus, prof.esrh[0], prof.ebwd[0])

data = [{
    "lat": 35.0,
    "lon": -90.0,
    "cape": float(cape),
    "scp": float(scp)
}]

with open("weather_data.json", "w") as f:
    json.dump(data, f)

print("✅ weather_data.json created with CAPE:", cape, "and SCP:", scp)
