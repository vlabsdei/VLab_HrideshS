
## Step 1: Launch the Simulation

1. Open the **PCIe vs NVLink Data Transfer Virtual Lab**.
2. Note the default configuration:

| Parameter                     | Default Value  |
| ----------------------------- | -------------- |
| Batch Tensor Data Size (D)    | 10 GB          |
| Interconnect Standard         | PCIe Gen4 x16  |
| GPU Processing Duration (T<sub>c</sub>)  | 100 ms         |

3. Familiarize yourself with the data transfer visualization and performance metrics.

---

## Step 2: Compare Interconnect Standards

1. Set Data Size to **10 GB** and Processing Duration to **100 ms**.
2. Switch between each interconnect standard and record:

| Interconnect        | Bandwidth  | Transfer Latency (ms) | Total Step (ms) | GPU Utilization (%) |
| ------------------- | ---------- | --------------------- | --------------- | ------------------- |
| PCIe Gen4 x16       | 64 GB/s    |                       |                 |                     |
| PCIe Gen5 x16       | 128 GB/s   |                       |                 |                     |
| NVLink (900 GB/s)   | 900 GB/s   |                       |                 |                     |

---

## Step 3: Study the Effect of Data Size

1. Set Interconnect to **PCIe Gen4** and Processing Duration to **100 ms**.
2. Vary Data Size:

| Data Size (GB) | Transfer Latency (ms) | GPU Utilization (%) |
| --------------- | --------------------- | ------------------- |
| 1               |                       |                     |
| 10              |                       |                     |
| 25              |                       |                     |
| 50              |                       |                     |
| 100             |                       |                     |

---

## Step 4: Study the Effect of Processing Duration

1. Set Data Size to **20 GB** and Interconnect to **PCIe Gen4**.
2. Vary Processing Duration:

| Processing Duration (ms) | GPU Utilization (%) |
| ------------------------ | ------------------- |
| 10                       |                     |
| 50                       |                     |
| 100                      |                     |
| 250                      |                     |
| 500                      |                     |

---

## Step 5: Identify the I/O-Bound Threshold

1. Using PCIe Gen4, find the data size at which GPU utilization drops below 50%.
2. Repeat for PCIe Gen5 and NVLink.
3. Record the I/O-bound threshold for each interconnect.

---

## Step 6: Verify the Utilization Formula

<div style="text-align: center; font-size: 1.2em; margin: 15px 0;">
  <em>GPU Utilization</em> = 
  <span style="display: inline-block; vertical-align: middle; text-align: center;">
    <span style="border-bottom: 1px solid currentColor; display: block; padding: 0 5px;">T<sub>c</sub></span>
    <span style="display: block; padding: 0 5px;">T<sub>c</sub> + T<sub>t</sub></span>
  </span> &times; 100%
</div>

1. Select specific values and calculate manually.
2. Compare with simulation output.

---

# Observation

Record all measured values and trends. Note the crossover points where workloads transition from compute-bound to I/O-bound.

---

# Result

The effects of batch tensor data size, interconnect bandwidth, and GPU processing duration on data transfer latency and GPU utilization were successfully studied. The experiment demonstrated the critical role of high-bandwidth interconnects in maintaining GPU efficiency for large-scale AI workloads.
