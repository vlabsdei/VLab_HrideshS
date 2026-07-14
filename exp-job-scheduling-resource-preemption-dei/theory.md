# Theory

## 1. Introduction

Modern GPU clusters serve multiple users and workloads simultaneously. Efficient job scheduling determines how computing resources are allocated, how long jobs wait, and how effectively the cluster is utilized. Poor scheduling leads to idle GPUs, long queue times, and wasted resources.

This experiment investigates three scheduling algorithms and two preemption strategies used in production GPU cluster management.

---

## 2. Job Scheduling Algorithms

### 2.1 FIFO (First In, First Out)

Jobs are processed in the order they arrive.

Advantages:
- Simple to implement
- Fair in arrival order

Disadvantages:
- Large jobs block the queue (convoy effect)
- Small urgent jobs must wait
- Poor utilization when job sizes vary

### 2.2 Shortest Job First (SJF)

Jobs with the shortest estimated runtime are processed first.

Advantages:
- Minimizes average wait time
- Efficiently handles mixed workloads

Disadvantages:
- Requires runtime estimation
- Long jobs may starve
- Not always fair

### 2.3 Fair-Share Priority

Resources are allocated proportionally based on priority and historical usage.

Advantages:
- Balances fairness across users
- Supports priority levels
- Prevents starvation

Disadvantages:
- More complex to implement
- May not minimize overall wait time

---

## 3. Preemption Eviction Protocols

When a higher-priority job arrives and no resources are available, existing jobs may be preempted (evicted).

### 3.1 Kill/Restart

The running job is terminated and must restart from the beginning.

- Fast eviction
- All progress is lost
- High waste of compute tokens

### 3.2 Graceful State Checkpointing

The running job saves its current state to storage before being evicted.

- Progress is preserved
- Job can resume from checkpoint
- Lower waste of compute tokens
- Requires checkpoint infrastructure

---

## 4. Key Metrics

### 4.1 Average Job Wait Time

<p align="center"><i>W<sub>avg</sub> = (&sum; Time in Queue) / (Total Completed Jobs)</i></p>

Measures how long jobs spend waiting in the queue before and between executions.

### 4.2 Cluster GPU Utilization

<p align="center"><i>Utilization = (&sum;(Nodes Used &times; Runtime)) / (Total Capacity &times; Time) &times; 100%</i></p>

Measures how effectively GPU resources are being used.

### 4.3 Wasted Compute Tokens

Resource cycles lost due to job evictions, restarts, or idle periods. Kill/Restart wastes all progress; checkpointing preserves partial work (losing only the checkpoint/resume overhead).

---

## 5. Workload Mix

Real clusters handle diverse workloads:
- **Core user requests**: Interactive inference, short-running jobs
- **Background execution**: Long-running training jobs, batch processing

The mix of job types significantly affects scheduling performance.

---

## 6. High-Priority Emergency Jobs

Production clusters must handle urgent requests that preempt running workloads:
- Emergency inference requests
- Critical model updates
- Time-sensitive computations

The scheduling system must balance responsiveness with resource efficiency.

---

## 7. Virtual Lab Telemetry & Analysis

In a real-time accelerated simulation, manual tracking of individual job queue times or instantaneous cluster utilization is physically impossible. Therefore, the simulation automatically tracks and aggregates these metrics:

- **Average Job Wait Time (<i>W<sub>avg</sub></i>)**: Automatically updated as jobs complete, showing the rolling average of time spent in the queue.
- **GPU Utilization (EMA)**: Displays an Exponential Moving Average (EMA) of active nodes over total nodes, smoothing out instantaneous spikes to reflect overall load.
- **Wasted Compute Tokens**: Continuously tallied in real-time. When preemption occurs, lost progress is converted into wasted compute tokens based on the simulated processing speed.
- **Equations Panel**: A live diagnostic view accessed via the header. It breaks down exactly how the current theoretical metrics are being dynamically derived from the raw simulation data.

By utilizing the **"Record Reading"** feature in the Observations panel, you can snapshot these dynamic metrics at steady states for definitive comparison across different scheduling algorithms and preemption strategies. Data can then be exported via CSV for offline analysis.

---

## 8. Significance

Understanding job scheduling is essential for:
- Cluster Operations Engineers
- Cloud Platform Architects
- MLOps Engineers
- Infrastructure Managers
- DevOps Engineers

---

## Conclusion

Job scheduling directly impacts cluster efficiency, user experience, and resource waste. By comparing FIFO, SJF, and Fair-Share algorithms under different preemption strategies using automated simulation telemetry, students understand the trade-offs in workload orchestration for GPU computing infrastructure.
