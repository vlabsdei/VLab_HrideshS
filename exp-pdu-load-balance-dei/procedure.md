
## Step 1: Launch the Simulation

1. Open the **PDU Load Balancing & Phase Power Virtual Lab**.
2. Observe the default three-phase PDU system displayed in the viewport.
3. Note the initial values on the control panel:

| Parameter             | Default Value |
| --------------------- | ------------- |
| Phase L1 Current      | 25 A          |
| Phase L2 Current      | 25 A          |
| Phase L3 Current      | 25 A          |
| Phase L1 Angle        | 0°            |
| Phase L2 Angle        | 120°          |
| Phase L3 Angle        | 240°          |
| Neutral Current       | Observe       |

4. Familiarize yourself with the control panel, phasor diagram, and status indicators.

---

## Step 2: Observe Balanced Operation

1. Confirm all three phase currents are set to **25 A** at nominal angles (0°, 120°, 240°).
2. Observe:

   * Neutral return current should be approximately **0 A**
   * Power delivery status should read **Optimal**
   * Phasor diagram shows balanced symmetry

3. Record the baseline readings.

---

## Step 3: Study the Effect of Unbalanced Phase Currents

1. Keep phases L2 and L3 at **25 A**.
2. Gradually increase Phase L1 from **25 A** to **40 A**.
3. Observe:

   * Changes in neutral return current
   * Power delivery status transitions

4. Record observations:

| L1 Current (A) | L2 Current (A) | L3 Current (A) | Neutral Current (A) | Status         |
| --------------- | --------------- | --------------- | -------------------- | -------------- |
| 25              | 25              | 25              |                      |                |
| 30              | 25              | 25              |                      |                |
| 32              | 25              | 25              |                      |                |
| 35              | 25              | 25              |                      |                |
| 40              | 25              | 25              |                      |                |

---

## Step 4: Study Phase Angle Deviation Effects

1. Set all phase currents to **28 A**.
2. Keep L1 at 0° and L3 at 240°.
3. Shift Phase L2 angle from **120°** to **150°** in increments of **5°**.
4. Observe changes in neutral current.

| L2 Angle (°) | Neutral Current (A) |
| ------------- | -------------------- |
| 120           |                      |
| 125           |                      |
| 130           |                      |
| 135           |                      |
| 140           |                      |
| 145           |                      |
| 150           |                      |

---

## Step 5: Trigger a Breaker Trip

1. Set Phase L1 to **33 A** (above the 32 A breaker ceiling).
2. Observe:

   * Breaker trip activation
   * Power delivery status change
   * Impact on system operation


---

## Step 6: Simulate Harmonic Distortion Surge

1. Reset the simulation to default balanced values.
2. Activate the **Harmonic Distortion Surge** scenario.
3. Observe:

   * Phase angle shifts of ±15°
   * Increase in neutral return current
   * Changes in power delivery status

4. Compare balanced and distorted conditions.

---

## Step 7: Study Underpowered Conditions

1. Reduce Phase L1 to **20 A** (below the 25 A minimum).
2. Observe:

   * Power delivery status changes to **Underpowered**
   * Impact on system operation



---

## Step 8: Verify the Neutral Current Equation

Using the phasor summation formula:

*I*<sub>*N*</sub> = &radic;((*I*<sub>1</sub> cos *θ*<sub>1</sub> + *I*<sub>2</sub> cos *θ*<sub>2</sub> + *I*<sub>3</sub> cos *θ*<sub>3</sub>)<sup>2</sup> + (*I*<sub>1</sub> sin *θ*<sub>1</sub> + *I*<sub>2</sub> sin *θ*<sub>2</sub> + *I*<sub>3</sub> sin *θ*<sub>3</sub>)<sup>2</sup>)

1. Select custom values for all three phase currents and angles.
2. Calculate the neutral current manually.
3. Compare with the simulation output.
4. Determine whether the simulation follows the theoretical model.

---

# Observation

Record all measured values, trends, and notable changes observed during the experiment. Pay attention to the relationship between load imbalance and neutral current magnitude.

---

# Result

The effects of unbalanced phase currents, phase angle deviations, and harmonic distortion on neutral return current and power delivery status were successfully studied. The experiment demonstrated the importance of balanced three-phase power distribution for safe and efficient data center operation.
