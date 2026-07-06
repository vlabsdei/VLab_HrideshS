# Theory

## 1. Introduction

In modern high-performance computing and AI training systems, data must be transferred between the host CPU, system memory, and GPU VRAM before computation can begin. The speed of this data transfer is determined by the interconnect technology used to link these components.

As GPU computational capabilities have increased dramatically, the data transfer pathway has become a critical bottleneck. If data cannot be delivered to the GPU fast enough, the GPU remains idle, wasting expensive silicon resources.

This experiment investigates how different interconnect standards — PCIe Gen4, PCIe Gen5, and NVLink — affect data transfer latency, total processing time, and GPU utilization efficiency.

---

## 2. GPU Interconnect Technologies

### 2.1 PCIe (Peripheral Component Interconnect Express)

PCIe is the standard interconnect used in most computing systems to connect GPUs, storage devices, and network cards to the CPU.

| Standard    | Bandwidth (x16) | Release Year |
| ----------- | ---------------- | ------------ |
| PCIe Gen3   | 32 GB/s          | 2010         |
| PCIe Gen4   | 64 GB/s          | 2017         |
| PCIe Gen5   | 128 GB/s         | 2019         |
| PCIe Gen6   | 256 GB/s         | 2022         |

PCIe uses a point-to-point serial connection with a tree-like topology.

### 2.2 NVLink

NVLink is NVIDIA's proprietary high-bandwidth interconnect designed specifically for GPU-to-GPU and GPU-to-CPU communication.

| Generation | Bandwidth        |
| ---------- | ---------------- |
| NVLink 3   | 600 GB/s         |
| NVLink 4   | 900 GB/s         |

NVLink advantages:

- Direct GPU-to-GPU communication without CPU involvement
- Mesh topology enabling parallel data paths
- Unified memory address space across GPUs
- Significantly higher bandwidth than PCIe

---

## 3. Data Transfer Latency

Data transfer latency is the time required to move a batch of data from the source to GPU VRAM.

The formula is:

<div style="text-align: center; font-size: 1.2em; margin: 15px 0;">
  <em>T<sub>t</sub></em> = 
  <span style="display: inline-block; vertical-align: middle; text-align: center;">
    <span style="border-bottom: 1px solid currentColor; display: block; padding: 0 5px;">D</span>
    <span style="display: block; padding: 0 5px;">Bandwidth</span>
  </span>
</div>

Where:

| Symbol     | Description                      |
| ---------- | -------------------------------- |
| <em>T<sub>t</sub></em>      | Data Transfer Latency (seconds)  |
| <em>D</em>        | Batch Tensor Data Size (bytes)   |
| Bandwidth  | Interconnect throughput (bytes/s)|

Lower transfer latency means data arrives at the GPU faster, allowing computation to begin sooner.

---

## 4. GPU Processing Duration

The GPU processing execution duration (<em>T<sub>c</sub></em>) represents the time the GPU spends performing actual computations on the data.

This includes:

- Matrix multiplications
- Convolution operations
- Activation functions
- Gradient calculations

<em>T<sub>c</sub></em> depends on:

- Model architecture complexity
- Batch size
- GPU computational power (FLOPS)

---

## 5. Total Step Iteration Duration

Each training or inference step consists of two phases:

1. **Data Transfer** — Moving data to GPU VRAM
2. **Computation** — Processing the data

The total step duration is:

<div style="text-align: center; font-size: 1.2em; margin: 15px 0;">
  <em>T<sub>total</sub></em> = <em>T<sub>c</sub></em> + <em>T<sub>t</sub></em>
</div>

Ideally, <em>T<sub>t</sub></em> should be negligible compared to <em>T<sub>c</sub></em> so that most of the step time is spent on useful computation.

---

## 6. GPU Utilization

GPU utilization measures how efficiently the GPU is being used:

<div style="text-align: center; font-size: 1.2em; margin: 15px 0;">
  <em>GPU Utilization</em> = 
  <span style="display: inline-block; vertical-align: middle; text-align: center;">
    <span style="border-bottom: 1px solid currentColor; display: block; padding: 0 5px;">T<sub>c</sub></span>
    <span style="display: block; padding: 0 5px;">T<sub>c</sub> + T<sub>t</sub></span>
  </span> &times; 100%
</div>

| Utilization | Interpretation                    |
| ----------- | --------------------------------- |
| > 90%       | Excellent — compute-bound         |
| 70–90%      | Good — moderate I/O overhead      |
| 50–70%      | Poor — significant I/O bottleneck |
| < 50%       | Critical — GPU mostly idle        |

High GPU utilization means the interconnect is fast enough that the GPU spends most of its time computing rather than waiting for data.

---

## 7. I/O-Bound vs Compute-Bound Workloads

### I/O-Bound

When <em>T<sub>t</sub></em> &gt; <em>T<sub>c</sub></em>, the workload is I/O-bound:

- GPU spends more time waiting for data than computing
- Increasing GPU performance provides no benefit
- Upgrading the interconnect is the solution

### Compute-Bound

When <em>T<sub>c</sub></em> &gt; <em>T<sub>t</sub></em>, the workload is compute-bound:

- GPU spends most time on computation
- Data arrives before the GPU is ready for the next batch
- This is the ideal operating condition

---

## 8. NVLink Architecture Advantages

NVLink provides several architectural advantages over PCIe:

- **Mesh Topology**: Multiple parallel data paths vs PCIe's tree structure
- **High-Density Connections**: More physical lanes carrying data simultaneously
- **Direct Memory Fabric Mapping**: GPUs can directly access each other's VRAM
- **Reduced CPU Overhead**: GPU-to-GPU transfers bypass the CPU entirely

These features make NVLink essential for multi-GPU training workloads.

---

## 9. Significance of the Experiment

Understanding interconnect performance is essential for:

- AI Infrastructure Engineers
- HPC System Architects
- GPU Cluster Designers
- Performance Engineers
- Data Center Operators

The concepts explored in this experiment are directly applicable to designing efficient GPU clusters for AI training and inference workloads.

---

## Conclusion

The choice of interconnect technology has a profound impact on GPU utilization and overall system efficiency. By studying the effects of data size, interconnect bandwidth, and compute duration on transfer latency and GPU utilization, students gain insight into the I/O bottlenecks that limit performance in modern computing systems and the engineering solutions that address them.
