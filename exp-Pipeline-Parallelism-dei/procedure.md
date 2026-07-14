> **Note:** You do not need to manually record the values in the tables below. Simply click the **"Record Reading"** button in the Observations panel for each step, and the simulation will automatically log the data for you to export later 

## Step 1: Launch the Simulation

1. Open the **Pipeline Parallelism Wall-Clock Time Virtual Lab**.
2. Note defaults: Layers = 64, PP = 4, M = 16.

---

## Step 2: Study Pipeline Bubble Fraction

1. Set Layers = 64, M = 16, vary PP:

| Pipeline Stages (PP) | Bubble Fraction (%) | Step Duration | VRAM/Device |
| --------------------- | ------------------- | ------------- | ----------- |
| 2                     |                     |               |             |
| 4                     |                     |               |             |
| 8                     |                     |               |             |
| 16                    |                     |               |             |

---

## Step 3: Study Micro-Batch Effect

1. Set Layers = 64, PP = 8, vary M:

| Micro-batches (M) | Bubble Fraction (%) | Step Duration |
| ------------------ | ------------------- | ------------- |
| 4                  |                     |               |
| 8                  |                     |               |
| 16                 |                     |               |
| 32                 |                     |               |
| 64                 |                     |               |

---

## Step 4: Study Model Depth

1. Set PP = 4, M = 16, vary Layers:

| Layers | T_layer_group | Step Duration | Bubble (%) |
| ------ | ------------- | ------------- | ---------- |
| 32     |               |               |            |
| 64     |               |               |            |
| 96     |               |               |            |
| 128    |               |               |            |

---

## Step 5: Find Optimal Configuration

1. In the Quick Scenarios panel, click **"128-Layer Challenge"**.
2. This sets a deep 128-layer model. Your goal is to find the PP and M combination that minimizes bubble fraction while keeping VRAM per device under 80 GB.
3. Adjust PP and M. For each promising combination, click **"Record Reading"**.
4. Review your recordings to find the optimal setup.

---

## Step 6: Verify the Formulas

<p align="center"><i>T<sub>step</sub> = (M + PP &minus; 1) &times; T<sub>layer_group</sub></i></p>

<p align="center"><i>F<sub>bubble</sub> = (PP &minus; 1) / (M + PP &minus; 1)</i></p>

1. Click the **"Equations"** button in the header to view the live diagnostic panel.
2. Observe how the theoretical formulas are actively populated with raw data from the simulation engine.
3. Once you have completed all scenarios, click the **"Export CSV"** button in the Observations panel to download your recorded dataset for final analysis.
---

# Observation

Record all values using the **"Record Reading"** button. Note how increasing M reduces bubble fraction while increasing PP increases it.

---

# Result

The effects of network layer depth, pipeline stage splits, and micro-batch sizing on pipeline bubble overhead and wall-clock training time were successfully studied. The experiment demonstrated the importance of balancing pipeline stages with micro-batch counts for efficient distributed training.
