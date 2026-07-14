# Procedure

> **Note:** You do not need to manually record the values in the tables below. Simply click the **"Record Reading"** button in the Observations panel for each step, and the simulation will automatically log the data for you to export later.

## Step 1: Launch the Simulation & Familiarize Interface

1. Open the **Job Scheduling & Resource Preemption Virtual Lab**.
2. Identify the main control panels on the left: **Scheduling Configuration**, **Cluster & Workload**, and **Quick Scenarios**.
3. Identify the real-time **Dashboard** at the bottom tracking metrics like Avg Wait Time, GPU Utilization, and Wasted Compute.
4. Click the **"Start"** button in the header to begin the simulation.

---

## Step 2: Compare Scheduling Algorithms

1. Under Scheduling Configuration, set Algorithm to **FIFO** and Preemption to **Kill / Restart**.
2. Set Workload Mix to **50:50** and Job Arrival Rate to a moderate level (e.g., **18/min**).
3. Allow the simulation to run until a steady queue forms. Click the **"Record Reading"** button in the Observations panel to snapshot the metrics.
4. Switch the Algorithm to **SJF (Shortest Job First)**. Let the system stabilize, then click **"Record Reading"**.
5. Switch the Algorithm to **Fair-Share**. Let the system stabilize, then click **"Record Reading"**.
6. Review the Observations table to compare how Avg Wait Time and GPU Utilization change across algorithms.

| Algorithm | Avg Wait Time | GPU Utilization |
| :-------: | :-----------: | :-------------: |
| FIFO      |               |                 |
| SJF       |               |                 |
| Fair-Share|               |                 |

---

## Step 3: Analyze Preemption Protocols

1. Ensure the Algorithm is set to **Fair-Share**.
2. With Preemption set to **Kill / Restart**, click **"Inject High-Priority Emergency Job"** in the Quick Scenarios panel.
3. Watch the visualizer: An active node will flash red ("EVICTED") as its job is killed. Wait for the emergency job to finish and the evicted job to restart.
4. Click **"Record Reading"** and note the spike in Wasted Compute Tokens.
5. Change Preemption to **Checkpoint**.
6. Click **"Inject High-Priority Emergency Job"** again. Observe the eviction and recovery.
7. Click **"Record Reading"** and compare the Wasted Compute Tokens and Avg Recovery Time against the Kill/Restart method.

| Preemption Method | Wasted Compute Tokens | Avg Recovery Time |
| :---------------: | :-------------------: | :---------------: |
| Kill / Restart    |                       |                   |
| Checkpoint        |                       |                   |

---

## Step 4: Study Workload Mix Effects

1. Reset the simulation using the **"Reset Cluster"** button.
2. Set Algorithm to **FIFO**.
3. Adjust the **Workload Mix** slider to **80:20** (heavy on short interactive jobs). Let it stabilize and click **"Record Reading"**.
4. Adjust the **Workload Mix** slider to **20:80** (heavy on long training jobs). Let it stabilize and click **"Record Reading"**.
5. Observe how a high proportion of long jobs impacts the queue length and wait times for short jobs.

| Workload Mix | Avg Wait Time | GPU Utilization |
| :----------: | :-----------: | :-------------: |
| 80:20        |               |                 |
| 20:80        |               |                 |
    
---

## Step 5: Observe the FIFO Convoy Effect

1. In the Quick Scenarios panel, click **"FIFO Convoy Test"**.
2. This preset configures a 1-node cluster and submits a single very long job followed immediately by many short jobs.
3. Observe the visual queue: The short jobs are blocked waiting for the single long job to finish.
4. Click **"Record Reading"** to log the detrimental effect on Avg Wait Time.
5. Change the Algorithm to **SJF** and see how the queue order instantly re-sorts to prioritize the short jobs.

---

## Step 6: Review Automated Metrics & Equations

Because the simulation operates at an accelerated timescale, manual calculation of metrics from raw event timestamps is not feasible.

<p align="center"><i>W<sub>avg</sub> = (&sum; Time in Queue) / (Total Completed Jobs)</i></p>

<p align="center"><i>Utilization = (&sum;(Nodes &times; Runtime)) / (Capacity &times; Time) &times; 100%</i></p>

1. Instead of manual calculation, rely on the real-time telemetry engine. Click the **"Equations"** button in the header to view the live diagnostic panel.
2. Observe how the theoretical formulas for <i>W<sub>avg</sub></i> and Utilization are actively populated with raw data from the simulation engine.
3. Once you have completed all scenarios, click the **"Export CSV"** button in the Observations panel to download your recorded dataset for final analysis.

---

# Observation

Record all values in the Observations table using the **"Record Reading"** button. Note how checkpointing dramatically reduces wasted compute compared to Kill/Restart, and how SJF minimizes average wait time compared to FIFO.

---

# Result

The effects of scheduling algorithms, preemption protocols, and workload mixes on job wait time, GPU utilization, and wasted compute resources were successfully studied using automated telemetry. The experiment demonstrated the importance of intelligent scheduling and state checkpointing for efficient GPU cluster management.
