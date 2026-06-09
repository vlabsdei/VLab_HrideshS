
## Step 1: Launch the Simulation

1. Open the **Liquid Cooling Flow Rate Dynamics Virtual Lab**.
2. Observe the default liquid cooling system displayed in the viewport.
3. Note the initial values displayed on the control panel:

| Parameter                          | Default Value     |
| ---------------------------------- | ----------------- |
| Coolant Mass Flow Rate (ṁ)        | 1.5 LPM           |
| Inlet Water Temperature (T<sub>in</sub>) | 25 °C             |
| GPU Heat Load (Q)                | 500 W             |
| Outlet Water Temperature (T<sub>out</sub>)| Observe Dashboard |

4. Familiarize yourself with the control panel, dashboard, and visualization viewport.

---

## Step 2: Explore the Liquid Cooling System

1. Examine the liquid cooling loop components displayed in the simulation.
2. Identify the following components:

| Component       | Function                                              |
| --------------- | ----------------------------------------------------- |
| Cold Plate      | Absorbs heat from the GPU and transfers it to coolant |
| Pump            | Circulates coolant through the cooling loop           |
| Heat Exchanger  | Removes heat from the coolant before recirculation    |
| Piping Network  | Transports coolant throughout the system              |
| Coolant (Water) | Absorbs and carries thermal energy                    |

3. Observe the direction of coolant flow and the heat transfer path.

---

## Step 3: Study the Effect of Coolant Flow Rate

1. Reset the simulation to default values.

2. Set Inlet Water Temperature to **25 °C** and GPU Heat Load to **500 W**.

3. Gradually increase the **Coolant Mass Flow Rate** from **0.5 LPM** to **3.0 LPM**.

4. Observe the following:

   * Outlet Water Temperature (T<sub>out</sub>)
   * Thermal Resistance (R)
   * Cluster Water Consumption Penalty

5. Record the Outlet Water Temperature for the following flow rates:

| Flow Rate (LPM) | Outlet Temperature (°C) | Thermal Resistance (mK/W) |
| ---------------- | ----------------------- | ------------------------- |
| 0.5              |                         |                           |
| 1.0              |                         |                           |
| 1.5              |                         |                           |
| 2.0              |                         |                           |
| 2.5              |                         |                           |
| 3.0              |                         |                           |

---

## Step 4: Study the Effect of Inlet Water Temperature

1. Set:

   * Coolant Flow Rate = **1.5 LPM**
   * GPU Heat Load = **500 W**

2. Increase the Inlet Water Temperature from **20 °C** to **30 °C** in increments of **2 °C**.

3. Observe changes in:

   * Outlet Water Temperature
   * Thermal Resistance
   * Overall cooling effectiveness

4. Record your observations.

| Inlet Temperature (°C) | Outlet Temperature (°C) |
| ----------------------- | ----------------------- |
| 20                      |                         |
| 22                      |                         |
| 24                      |                         |
| 26                      |                         |
| 28                      |                         |
| 30                      |                         |

---

## Step 5: Study the Effect of GPU Heat Load

1. Set:

   * Coolant Flow Rate = **1.5 LPM**
   * Inlet Water Temperature = **25 °C**

2. Increase the GPU Heat Load from **250 W** to **1000 W**.

3. Observe:

   * Outlet Temperature changes
   * Thermal Resistance behavior
   * Cluster Water Consumption Penalty

4. Record the results:

| GPU Heat Load (W) | Outlet Temperature (°C) | Water Consumption (L/min) |
| ------------------ | ----------------------- | ------------------------ |
| 250                |                         |                          |
| 500                |                         |                          |
| 750                |                         |                          |
| 1000               |                         |                          |

---

## Step 6: Observe Diminishing Returns

1. Set GPU Heat Load to **750 W** and Inlet Temperature to **25 °C**.

2. Gradually increase the flow rate from **0.5 LPM** to **3.0 LPM** in **0.5 LPM** increments.

3. Observe:

   * The rate of improvement in cooling performance
   * The point at which additional flow provides minimal benefit
   * The increase in water consumption penalty

4. Identify the approximate flow rate beyond which diminishing returns become significant.

---

## Step 7: Study Water Consumption Impact

1. Set the GPU Heat Load to maximum (**1000 W**).

2. Increase the flow rate to maximum (**3.0 LPM**).

3. Observe:

   * Total cluster water consumption penalty
   * The environmental cost of maintaining maximum cooling performance

4. Compare water consumption at different flow rates and heat loads.

---

## Step 8: Verify the Heat Absorption Equation

Using the heat absorption equation:


Q = ṁ × C<sub>p</sub> × (T<sub>out</sub> − T<sub>in</sub>)


Where C<sub>p</sub> = 4186 J/(kg·°C)

1. Select any values for:

   * Coolant Mass Flow Rate
   * Inlet Water Temperature
   * GPU Heat Load

2. Calculate the Outlet Water Temperature manually.

3. Compare the calculated value with the simulation output.

4. Determine whether the simulation follows the theoretical model.

---

## Step 9: Compare Different Operating Conditions

Complete the following comparison table:

| Condition             | Outlet Temp (°C) | Thermal Resistance (mK/W) | Water Consumption (L/min) |
| --------------------- | ----------------- | ------------------------- | ------------------------ |
| Low Flow (0.5 LPM)   |                   |                           |                          |
| Medium Flow (1.5 LPM) |                   |                           |                          |
| High Flow (3.0 LPM)  |                   |                           |                          |
| High Heat Load (1000W)|                   |                           |                          |

---

# Observation

Record all measured values, trends, and notable changes observed during the experiment. Pay particular attention to the non-linear relationship between flow rate and thermal resistance, and the environmental impact of water consumption.

---

# Result

The effects of coolant mass flow rate, inlet water temperature, and GPU heat load on outlet water temperature, thermal resistance, and cluster water consumption were successfully studied. The experiment demonstrated the heat absorption dynamics of liquid cooling systems and highlighted the engineering trade-offs between cooling performance, energy consumption, and environmental sustainability in modern data center infrastructure.