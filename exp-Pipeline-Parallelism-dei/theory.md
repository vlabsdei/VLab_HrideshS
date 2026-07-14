# Theory

## 1. Introduction

Training large deep neural networks requires distributing computation across multiple GPUs. Pipeline parallelism is one of the primary strategies, where different layers of the model are assigned to different GPUs. Data flows through the pipeline as a sequence of micro-batches, with each GPU processing its assigned layers.

However, pipeline parallelism introduces idle periods called "pipeline bubbles" where some GPUs wait for data from upstream stages. Understanding and minimizing these bubbles is critical for efficient distributed training.

---

## 2. Pipeline Parallelism

In pipeline parallelism, a neural network with L layers is divided into PP pipeline stages, each assigned to a separate GPU.

Each GPU processes only its assigned layers:
- GPU 1: Layers 1 to L/PP
- GPU 2: Layers (L/PP)+1 to 2L/PP
- GPU PP: Layers (PP-1)L/PP+1 to L

---

## 3. Micro-Batching

Instead of processing one large batch, the input is divided into M smaller micro-batches. These micro-batches flow through the pipeline in sequence, allowing multiple GPUs to be active simultaneously.

More micro-batches → Better pipeline utilization → Less bubble overhead

---

## 4. Pipeline Bubble

The pipeline bubble represents the fraction of time during which GPUs are idle, waiting for data.

### Step Duration

<p align="center"><i>T<sub>step</sub> = (M + PP &minus; 1) &times; T<sub>layer_group</sub></i></p>

Where:
| Symbol           | Description                          |
| :--------------: | :----------------------------------: |
| <i>M</i>              | Number of micro-batches              |
| <i>PP</i>             | Number of pipeline stages            |
| <i>T<sub>layer_group</sub></i>| Time to process one stage (compute + transfer) |

### Bubble Fraction

<p align="center"><i>F<sub>bubble</sub> = (PP &minus; 1) / (M + PP &minus; 1)</i></p>

Key observations:
- More pipeline stages (PP) → Larger bubble fraction
- More micro-batches (M) → Smaller bubble fraction
- Optimal configuration balances PP and M

---

## 5. Layer Group Processing Time

Each layer group's processing time combines computation and data transfer:

<p align="center"><i>T<sub>layer_group</sub> = T<sub>compute</sub> + T<sub>transfer</sub></i></p>

Where:
- <i>T<sub>compute</sub></i> depends on GPU processing power (related to Experiment 1's thermal behavior)
- <i>T<sub>transfer</sub></i> depends on interconnect bandwidth (related to Experiment 5's PCIe/NVLink analysis)

---

## 6. VRAM Footprint Reduction

Pipeline parallelism reduces per-device memory requirements:

<p align="center"><i>VRAM<sub>per_device</sub> &asymp; (Total Model Memory / PP) + activations</i></p>

This enables training models that are too large for a single GPU's VRAM.

---

## 7. Trade-offs

| More Pipeline Stages (PP) | Fewer Pipeline Stages (PP) |
| :-----------------------: | :------------------------: |
| Lower per-GPU memory      | Higher per-GPU memory      |
| Larger pipeline bubble    | Smaller pipeline bubble    |
| More inter-GPU transfers  | Fewer inter-GPU transfers  |

| More Micro-batches (M)    | Fewer Micro-batches (M)   |
| :-----------------------: | :------------------------: |
| Smaller bubble fraction   | Larger bubble fraction     |
| Higher memory for activations | Lower memory for activations |
| Better pipeline utilization | Poorer pipeline utilization |

---

## 8. Connection to Other Experiments

This experiment integrates concepts from:
- **Experiment 1**: GPU thermal behavior affects compute duration
- **Experiment 5**: Interconnect bandwidth affects transfer duration
- **Experiment 4**: Model memory determines minimum PP stages

---

## 9. Virtual Lab Telemetry & Analysis

In a real-time accelerated simulation, manual calculation of pipeline metrics is cumbersome. Therefore, the simulation automatically tracks and aggregates these metrics:

- **Bubble Fraction**: Automatically updated based on PP and M settings.
- **Step Duration**: Calculates the total time for a full pipeline step considering hardware factors.
- **VRAM / Device**: Dynamically models the memory constraint per GPU.
- **Equations Panel**: A live diagnostic view accessed via the header. It breaks down exactly how the current theoretical metrics are being dynamically derived from the raw simulation data.

By utilizing the **"Record Reading"** feature in the Observations panel, you can snapshot these dynamic metrics at steady states for definitive comparison across different pipeline configurations. Data can then be exported via CSV for offline analysis.

---

## 10. Significance

Understanding pipeline parallelism is essential for:
- AI Training Engineers
- Distributed Systems Architects
- ML Infrastructure Engineers
- Performance Engineers

---

## Conclusion

Pipeline parallelism enables training of very large models by distributing layers across multiple GPUs. However, the pipeline bubble introduces idle time that can significantly reduce effective throughput. By carefully balancing pipeline stages and micro-batch sizes using automated simulation telemetry, engineers can minimize idle time and maximize cluster utilization for efficient distributed training.
