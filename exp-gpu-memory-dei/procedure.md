
## Step 1: Launch the Simulation

1. Open the **LLM Tensor Memory Footprint Virtual Lab**.
2. Observe the default configuration displayed on the control panel:

| Parameter                | Default Value  |
| ------------------------ | -------------- |
| Model Parameter Count    | 7B             |
| Quantization Bit-Width   | FP16 (16-bit)  |
| Context Length            | 2048 tokens    |
| Batch Size                | 1              |
| Available GPU Hardware    | NVIDIA H100 — 80 GB |

3. Familiarize yourself with the memory usage breakdown and deployment status indicators on the right-side dashboard.
4. Locate the **Quick Scenarios**, the **Equations** toggle, and the **Observations** recording controls.

---

## Step 2: Study the Effect of Model Size

1. Set Quantization to **FP16**, Context Length to **2048**, Batch Size to **1**.
2. Vary the Model Parameter Count through the following values.
3. For each value, click **Record Reading** to log it, and note the VRAM usage below:

| Parameters (B) | Weights Memory (GB) | KV Cache (GB) | Total (GB) | Status   |
| --------------- | -------------------- | -------------- | ---------- | -------- |
| 1               |                      |                |            |          |
| 7               |                      |                |            |          |
| 13              |                      |                |            |          |
| 30              |                      |                |            |          |
| 70              |                      |                |            |          |
| 100             |                      |                |            |          |

---

## Step 3: Study the Effect of Quantization

1. Set Model Size to **13B**, Context Length to **2048**, Batch Size to **1**.
2. Change Quantization Bit-Width through each option, clicking **Record Reading** for each:

| Quantization | Weights Memory (GB) | Total VRAM (GB) | Status   |
| ------------ | -------------------- | --------------- | -------- |
| FP32 (32-bit)|                      |                 |          |
| FP16 (16-bit)|                      |                 |          |
| INT8 (8-bit) |                      |                 |          |
| INT4 (4-bit) |                      |                 |          |

3. Observe how quantization reduces the memory footprint.

---

## Step 4: Study the Effect of Context Length

1. Set Model Size to **7B**, Quantization to **FP16**, Batch Size to **8**.
2. Increase Context Length, clicking **Record Reading** for each, and observe KV Cache growth:

| Context Length (tokens) | KV Cache Memory (GB) | Total VRAM (GB) | Status   |
| ----------------------- | --------------------- | --------------- | -------- |
| 512                     |                       |                 |          |
| 2048                    |                       |                 |          |
| 8192                    |                       |                 |          |
| 16384                   |                       |                 |          |
| 32768                   |                       |                 |          |

---

## Step 5: Study the Effect of Batch Size

1. Set Model Size to **7B**, Quantization to **FP16**, Context Length to **8192**.
2. Increase Batch Size, clicking **Record Reading** for each, and observe:

| Batch Size | KV Cache Memory (GB) | Total VRAM (GB) | Status   |
| ---------- | --------------------- | --------------- | -------- |
| 1          |                       |                 |          |
| 4          |                       |                 |          |
| 16         |                       |                 |          |
| 64         |                       |                 |          |
| 128        |                       |                 |          |

---

## Step 6: Trigger a CUDA OOM Crash

1. Configure a large model with high precision and large context:
   * Model: **70B**, Quantization: **FP16**, Context: **32768**, Batch: **64**
   * *(Alternatively, you can click the **Trigger OOM** button in the Quick Scenarios section).*
2. Observe the deployment failure and the red visual overflow warnings.
3. Identify which parameter contributes most to the memory overflow and click **Record Reading**.

---

## Step 7: Optimize for Successful Deployment

1. Starting from the OOM configuration in Step 6, reduce parameters to achieve a successful deployment.
2. Try each optimization individually:
   * Lower quantization to INT4
   * Reduce context length
   * Decrease batch size
3. Click **Record Reading** for the combination that achieves successful deployment with maximum throughput.
4. Compare your manual optimizations with the **Fix OOM** Quick Scenario.

---

## Step 8: Study the Necessity of GPU Clusters

1. Configure the maximum possible settings:
   * Model: **100B**, Quantization: **FP32**, Context: **32768**, Batch: **128**
2. Attempt to deploy this on a single 80 GB GPU (using the GPU Hardware dropdown) and observe the massive OOM overflow.
3. Incrementally upgrade the GPU hardware to larger clusters (e.g., 8x, 64x, 256x, 512x) using the dropdown until the deployment succeeds.
4. Click **Record Reading** to log the required cluster size and total memory needed for this max-setting deployment.

---

## Step 9: Identify Resource Underutilization

1. Configure a small model with optimized settings:
   * Model: **1B**, Quantization: **INT4**, Context: **512**, Batch: **1**
2. Deploy this model on a massive **512x NVIDIA H100 — 41 TB** cluster.
3. Observe the "Underused" status and the blue warning indicators on the dashboard and canvas.
4. Scale down the GPU hardware sequentially using the dropdown until the utilization enters the optimal "good" or "high usage" ranges, eliminating the resource waste.
5. Click **Record Reading** to log the optimized hardware configuration.

---

## Step 10: Verify the Memory Equations

Using the formulas:

<br><b>M<sub>weights</sub> = N &times; (Q<sub>b</sub>/8) &times; 1.2</b><br>

<br><b>M<sub>cache</sub> = 2 &times; B &times; L &times; D<sub>model</sub> &times; N<sub>layers</sub> &times; (Q<sub>b</sub>/8)</b><br>

1. Select specific values and calculate the expected memory manually.
2. Click the **Equations** button in the top header to open the live calculation panel.
3. Compare your manual calculations with the step-by-step breakdown shown in the simulation panel.
4. Verify that the simulation follows the theoretical model correctly.

---

# Observation

Record all measured values, trends, and critical thresholds observed during the experiment using the simulation's recording features. 
Once all steps are complete, click **Export CSV** in the Observations section to download your recorded data. 
Note which parameter has the greatest impact on total VRAM usage, and document instances of both OOM and Resource Underutilization.

---

# Result

The effects of model parameter count, quantization bit-width, context length, and batch size on GPU VRAM requirements were successfully studied. The experiment demonstrated the memory management trade-offs required for deploying Large Language Models, the necessity of massive GPU clusters for 100B parameter models, and the importance of right-sizing compute hardware to avoid resource underutilization.
