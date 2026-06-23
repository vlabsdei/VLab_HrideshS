## 1. Introduction

Large Language Models (LLMs) have revolutionized artificial intelligence, powering applications from natural language understanding and generation to code synthesis and scientific reasoning. Models such as GPT, LLaMA, and Gemini contain billions of trainable parameters that must be stored in GPU Video RAM (VRAM) during inference.

Understanding the memory requirements of these models is critical for AI infrastructure engineers who must decide which GPU hardware to deploy, how to configure quantization, and how to balance throughput with memory constraints.

This experiment investigates how model size, quantization precision, context length, and batch size affect the total GPU memory footprint required to deploy an LLM.

---

## 2. Large Language Model Architecture

Modern LLMs are based on the Transformer architecture, which consists of:

- **Embedding layers** — Convert input tokens into vector representations
- **Attention layers** — Compute relationships between tokens using self-attention
- **Feed-forward layers** — Process attention outputs through dense neural networks
- **Output layers** — Generate probability distributions over the vocabulary

Key architectural parameters:

| Parameter    | Description                                      |
| ------------ | ------------------------------------------------ |
| N            | Total number of trainable parameters             |
| D<sub>model</sub> | Hidden dimension size of the model               |
| N<sub>layers</sub> | Number of transformer layers                     |
| N<sub>heads</sub>  | Number of attention heads per layer               |
| Vocabulary   | Total number of tokens the model can process     |

---

## 3. GPU VRAM, Memory Hierarchy, and Clusters

GPU VRAM (Video Random Access Memory) is the primary memory used for storing model weights and intermediate computations during inference.

Modern GPUs offer varying VRAM capacities, and for massive models, they are often grouped into high-bandwidth clusters:

| GPU Configuration | VRAM Capacity |
| ----------------- | ------------- |
| NVIDIA A100       | 40 GB / 80 GB |
| NVIDIA H100       | 80 GB         |
| 8x NVIDIA H100    | 640 GB        |
| 64x NVIDIA H100   | 5.12 TB       |
| 512x NVIDIA H100  | 41 TB         |

When the total memory requirement exceeds available VRAM, the GPU triggers a **CUDA Out-of-Memory (OOM)** error, causing the deployment to fail. Conversely, allocating a massive cluster for a lightweight model leads to **Resource Underutilization**, an expensive waste of computational power.

---

## 4. Model Weights Memory

The static memory required to store model weights depends on the number of parameters and the precision (bit-width) used to represent each parameter.

The formula is:

<br><b>M<sub>weights</sub> = N &times; (Q<sub>b</sub>/8) &times; 1.2</b><br>

Where:

| Symbol      | Description                                  |
| ----------- | -------------------------------------------- |
| M<sub>weights</sub> | Memory for model weights (bytes)           |
| N         | Number of model parameters                   |
| Q<sub>b</sub>       | Quantization bit-width (4, 8, 16, or 32 bits)|
| 1.2         | Overhead factor for runtime allocations       |

The 1.2 multiplier accounts for additional memory consumed by optimizer states, temporary buffers, and framework overhead.

---

## 5. Quantization

Quantization is the process of reducing the numerical precision of model weights to decrease memory usage and improve inference speed.

| Precision | Bit-Width | Memory per Parameter | Use Case                    |
| --------- | --------- | -------------------- | --------------------------- |
| FP32      | 32 bits   | 4 bytes              | Training, high accuracy     |
| FP16      | 16 bits   | 2 bytes              | Standard inference          |
| INT8      | 8 bits    | 1 byte               | Optimized inference         |
| INT4      | 4 bits    | 0.5 bytes            | Maximum compression         |

### Trade-offs:

- Lower precision → Less memory → Faster inference → Potential accuracy loss
- Higher precision → More memory → Slower inference → Better accuracy

---

## 6. KV Cache Memory

During autoregressive text generation, the model must store Key-Value (KV) pairs for each token in the context window. This memory grows dynamically as the context length and batch size increase.

The formula is:

<br><b>M<sub>cache</sub> = 2 &times; B &times; L &times; D<sub>model</sub> &times; N<sub>layers</sub> &times; (Q<sub>b</sub>/8)</b><br>

Where:

| Symbol       | Description                           |
| ------------ | ------------------------------------- |
| M<sub>cache</sub>  | KV Cache Memory (bytes)               |
| 2            | Factor for both Keys and Values       |
| B          | Batch size (concurrent streams)       |
| L          | Context length (tokens)               |
| D<sub>model</sub>  | Model hidden dimension                |
| N<sub>layers</sub> | Number of transformer layers          |
| Q<sub>b</sub>        | Quantization bit-width                |

---

## 7. Total Memory Requirement

The total GPU memory required for deployment is:

<br><b>M<sub>total</sub> = M<sub>weights</sub> + M<sub>cache</sub></b><br>

If M<sub>total</sub> exceeds available GPU VRAM, the deployment fails with a CUDA OOM error.

---

## 8. Context Length

Context length determines how many tokens the model can process in a single forward pass.

- Short contexts (512 tokens) — Low memory overhead
- Long contexts (32,768 tokens) — Significant KV cache expansion

As context length increases linearly, KV cache memory also increases linearly, potentially dominating the total memory footprint for large batch sizes.

---

## 9. Batch Size

Batch size represents the number of concurrent inference streams processed simultaneously.

- Small batches (1–4) — Low throughput, low memory
- Large batches (64–128) — High throughput, high memory

Increasing batch size multiplies the KV cache requirement proportionally.

---

## 10. Deployment Feasibility and Resource Efficiency

A deployment is feasible when:

<br><b>M<sub>total</sub> &le; VRAM<sub>available</sub></b><br>

When this condition is not met (OOM), engineers must:

- Reduce model size
- Lower quantization precision
- Shorten context length
- Decrease batch size
- Scale up to a larger GPU cluster

When M<sub>total</sub> is significantly lower than VRAM<sub>available</sub> (e.g., &lt; 20% utilization), the deployment suffers from **underutilization**. To fix this, engineers must:
- Scale down the hardware to a smaller GPU or fewer GPUs.
- Increase batch size to maximize throughput.
- Host multiple model instances on the same hardware.

Right-sizing the hardware prevents wasting millions of dollars in compute costs while avoiding OOM crashes.

---

## 11. Significance of the Experiment

Understanding LLM memory requirements is essential for:

- AI Infrastructure Engineers
- Machine Learning Engineers
- Cloud Platform Architects
- Data Center Operators
- Research Scientists

These concepts are directly applicable to deploying production AI systems at scale.

---

## Conclusion

Deploying Large Language Models requires careful consideration of GPU memory constraints. By studying the effects of model parameter count, quantization bit-width, context length, and batch size on VRAM usage, students gain practical insight into the memory management challenges faced by modern AI infrastructure teams.
