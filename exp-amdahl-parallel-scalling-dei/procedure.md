# Procedure

## Step 1: Launch the Simulation

1. Open the **Amdahl's Law & Parallel Scaling Virtual Lab**.
2. Note the initial default parameters: Parallelization Factor (<i>P<sub>f</sub></i>) = 0.95, Node Count (<i>N</i>) = 16, Overhead Coefficient (<i>C<sub>o</sub></i>) = 0.001.
3. Familiarize yourself with the **Observations** panel; you can use the **⊕ Record Reading** and **↓ Export CSV** buttons to easily track your data throughout the experiment.

---

## Step 2: Study Classic Amdahl's Law (No Overhead)

1. Toggle the **"Classic Amdahl's Law"** button to **On**. This disables communication overhead (sets <i>C<sub>o</sub></i> = 0).
2. Set <i>P<sub>f</sub></i> = 0.95 and vary <i>N</i> using the slider.
3. Record the Speedup and Efficiency values from the dashboard (or use the Record button):

| Nodes (<i>N</i>) | Speedup (<i>S<sub>max</sub></i>) | Efficiency (<i>S/N &times; 100%</i>) |
| --------- | ------- | ----------------------- |
| 1         |         |                         |
| 4         |         |                         |
| 16        |         |                         |
| 64        |         |                         |
| 256       |         |                         |
| 1024      |         |                         |
| 4096      |         |                         |

---

## Step 3: Study the Effect of the Parallelization Factor

1. Set <i>N</i> = 256 and ensure Classic Amdahl's Law is still **On** (<i>C<sub>o</sub></i> = 0).
2. Vary <i>P<sub>f</sub></i> and observe the speedup.

| <i>P<sub>f</sub></i>  | Speedup | Max Theoretical Asymptote |
| ------ | ------- | --------------- |
| 0.80   |         | 5×              |
| 0.90   |         | 10×             |
| 0.95   |         | 20×             |
| 0.99   |         | 100×            |
| 0.999  |         | 1000×           |
| 0.9999 |         | 10000×          |

---

## Step 4: Introduce Communication Overhead

1. Toggle **Classic Amdahl's Law** to **Off** so the <i>C<sub>o</sub></i> slider is active.
2. Set <i>P<sub>f</sub></i> = 0.95.
3. For each <i>C<sub>o</sub></i> value, observe the speedup at different node counts.

| <i>C<sub>o</sub></i>  | Speedup (<i>N</i>=256) | Speedup (<i>N</i>=1024) | Speedup (<i>N</i>=4096) |
| ------ | --------------- | ---------------- | ---------------- |
| 0      |                 |                  |                  |
| 0.001  |                 |                  |                  |
| 0.005  |                 |                  |                  |
| 0.01   |                 |                  |                  |

---

## Step 5: Find the Point of Diminishing Returns

1. Set <i>P<sub>f</sub></i> = 0.95 and <i>C<sub>o</sub></i> = 0.002.
2. Look at the **Diminishing Returns (optimal N*)** metric on the dashboard.
3. Move the <i>N</i> slider to approach and exceed this point.
4. Record the optimal cluster size (<i>N<sup>*</sup></i>) where adding more nodes begins to actively degrade performance.

---

## Step 6: Observe Wasted Infrastructure Cost

1. The simulation assumes hardware costs of $30,000 per GPU node.
2. For <i>N &gt; N<sup>*</sup></i>, observe the **Wasted Infrastructure** metric on the dashboard. This calculates the capital squandered on negative scaling.
3. Try the "Massive Waste" quick scenario button to see this effect at scale.

---

## Step 7: Verify the Extended Formula

<p align="center"><i>S<sub>max</sub> = 1 / ((1 - P<sub>f</sub>) + (P<sub>f</sub> / N) + (C<sub>o</sub> &times; ln(N)))</i></p>

1. Toggle the **"∑ Equations"** button on the top ribbon.
2. Verify that the simulation's live step-by-step mathematical calculations match the theoretical formula provided above.

---

# Observation

Record all values in the tables (or export via CSV). Note how the communication overhead (<i>C<sub>o</sub> &times; ln(N)</i>) term causes the speedup curve to deviate from the classic Amdahl's asymptote, eventually peaking at <i>N<sup>*</sup></i> and then sharply declining.

---

# Result

The effects of the parallelization factor, node count, and communication overhead on theoretical speedup were successfully studied. The experiment visually and mathematically demonstrated Amdahl's Law, the point of diminishing returns, and the practical financial implications for GPU cluster sizing.
