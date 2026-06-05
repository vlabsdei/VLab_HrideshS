
## Step 1: Launch the Simulation

1. Open the **GPU Thermal Dissipation Virtual Lab**.
2. Observe the default GPU model displayed in the assembled view.
3. Note the initial values displayed on the control panel:

| Parameter                       | Default Value     |
| ------------------------------- | ----------------- |
| Ambient Temperature ($T_a$)     | 25 °C             |
| Power Draw ($P$)                | 300 W             |
| Thermal Resistance ($R_\theta$) | 0.10 °C/W         |
| Fan Mode                        | Auto              |
| Junction Temperature ($T_j$)    | Observe Dashboard |

4. Familiarize yourself with the control panel, dashboard, and visualization viewport.

---

## Step 2: Explore the GPU Structure

1. Switch to the **Exploded View**.
2. Observe the separation of the internal GPU components.
3. Identify the following layers:

| Component      | Function                                  |
| -------------- | ----------------------------------------- |
| Fan and Shroud | Provides forced-air cooling               |
| Heatsink       | Dissipates heat into the environment      |
| Thermal Paste  | Improves thermal contact between surfaces |
| GPU Die        | Primary heat source                       |
| PCB            | Supports electronic circuitry             |

4. Observe the labels and heat-flow indicators.
5. Return to the assembled view before proceeding.

---

## Step 3: Study the Effect of Power Draw

1. Reset the simulation to default values.

2. Enter the **Exploded View**.

3. Gradually increase the **Power Draw** from **100 W** to **700 W**.

4. Observe the following:

   * Junction Temperature ($T_j$)
   * Heat-flow intensity
   * GPU die color
   * Fan speed (RPM)
   * Thermal status indicator

5. Record the Junction Temperature for the following power levels:

| Power Draw (W) | Junction Temperature (°C) |
| -------------- | ------------------------- |
| 100            |                           |
| 300            |                           |
| 500            |                           |
| 700            |                           |

---

## Step 4: Study the Effect of Ambient Temperature

1. Set:

   * Power Draw = **300 W**
   * Thermal Resistance = **0.10 °C/W**

2. Increase the Ambient Temperature from **15 °C** to **40 °C** in increments of **5 °C**.

3. Observe changes in:

   * Junction Temperature
   * Cooling Efficiency
   * Thermal Status

4. Record your observations.

| Ambient Temperature (°C) | Junction Temperature (°C) |
| ------------------------ | ------------------------- |
| 15                       |                           |
| 20                       |                           |
| 25                       |                           |
| 30                       |                           |
| 35                       |                           |
| 40                       |                           |

---

## Step 5: Study the Effect of Thermal Resistance

1. Set:

   * Ambient Temperature = **25 °C**
   * Power Draw = **400 W**

2. Change the Thermal Resistance to:

   * 0.05 °C/W
   * 0.10 °C/W
   * 0.20 °C/W
   * 0.30 °C/W

3. Observe the corresponding Junction Temperature.

4. Analyze the relationship between thermal resistance and heat buildup.

| Thermal Resistance (°C/W) | Junction Temperature (°C) |
| ------------------------- | ------------------------- |
| 0.05                      |                           |
| 0.10                      |                           |
| 0.20                      |                           |
| 0.30                      |                           |

---

## Step 6: Study Thermal Paste Degradation

1. Switch to the **Exploded View**.

2. Activate the **Thermal Paste Degradation** scenario.

3. Observe:

   * Changes in the appearance of the thermal paste layer
   * Increase in thermal resistance
   * Rise in junction temperature
   * Changes in cooling efficiency

4. Compare the results with the normal condition.

| Condition      | Junction Temperature (°C) |
| -------------- | ------------------------- |
| Normal Paste   |                           |
| Degraded Paste |                           |

---

## Step 7: Study HVAC Failure

1. Restore the simulation to its default state.

2. Set Power Draw to **500 W**.

3. Activate the **HVAC Failure** scenario.

4. Observe:

   * Increase in ambient temperature
   * Rise in junction temperature
   * Reduction in cooling effectiveness

5. Record the resulting junction temperature.

---

## Step 8: Observe Thermal Throttling

1. Increase the Power Draw until the GPU temperature exceeds **85 °C**.

2. Observe the following:

   * Thermal Status changes to **Throttling**
   * Performance percentage decreases
   * Compute throughput (TFLOPS) decreases

3. Record the temperature at which throttling begins.

| Parameter                    | Value |
| ---------------------------- | ----- |
| Throttling Temperature       |       |
| Performance After Throttling |       |

---

## Step 9: Compare Different Cooling Conditions

Complete the following comparison table:

| Condition                 | Junction Temperature (°C) | Performance (%) | Thermal Status |
| ------------------------- | ------------------------- | --------------- | -------------- |
| Normal Operation          |                           |                 |                |
| Thermal Paste Degradation |                           |                 |                |
| HVAC Failure              |                           |                 |                |
| Maximum Fan Speed         |                           |                 |                |

---

## Step 10: Verify the Thermal Model

Using the thermal equation:

$$
T_j = T_a + (P \times R_\theta)
$$

1. Select any values for:

   * Ambient Temperature
   * Power Draw
   * Thermal Resistance

2. Calculate the Junction Temperature manually.

3. Compare the calculated value with the simulation output.

4. Determine whether the simulation follows the theoretical model.

---

# Observation

Record all measured values, trends, and notable changes observed during the experiment.

---

# Result

The effects of ambient temperature, power consumption, thermal resistance, thermal paste degradation, cooling efficiency, and thermal throttling on GPU thermal behavior were successfully studied. The experiment demonstrated the heat-transfer path from the GPU die to the surrounding environment and highlighted the importance of efficient thermal management in modern computing systems.
