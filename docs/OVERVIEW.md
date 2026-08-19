# VAAYU — What We're Building, in Plain Language

*Read this first. The technical README assumes you already know why this matters — this document doesn't.*

---

## The one-sentence version

India knows its air is bad, but doesn't know *where* it's bad, *when* it will get worse, or *which* of thousands of pollution sources to go after first. We're building the system that answers those three questions and hands the answer to the official who can actually do something about it.

---

## Part 1: The problem, told properly

### India measures air quality in far too few places

There are roughly 1,300 air quality monitoring stations in India, and only a few hundred of those report in real time. India is 3.3 million square kilometres.

Picture it this way: imagine trying to understand the weather across all of India using thermometers placed only in a few hundred spots, mostly in big cities. If you live in a district without one, the honest answer to "how bad is the air outside my house right now?" is **nobody knows.**

That's the situation for most Indian districts, and for most parliamentary constituencies. The pollution is happening. It just isn't being measured.

### But here's the part people miss — measurement isn't actually the bottleneck

This is the insight the whole project is built on.

India already has a lot of machinery for this:
- Satellites already detect farm fires in Punjab and Haryana every single day, and the results already go to district officials.
- The pollution control board already runs monitoring stations and publishes the data.
- There's a legal body (CAQM) with real power to shut down construction sites and brick kilns when air gets dangerous.
- Punjab put **10,500 field staff** on the ground in the 2025 burning season.

So the equipment exists. The law exists. The people exist. And Delhi still chokes every November.

### So what's actually broken?

Three gaps sit between "we have data" and "someone did something useful":

**Gap 1 — Blind spots.** Data exists at a few hundred points. Everything between those points is guesswork.

**Gap 2 — Reacting too late.** Officials respond *after* pollution spikes. By then people have already breathed it. What's needed is a warning two or three days ahead so restrictions can be put in place *before* the bad air arrives, not after.

**Gap 3 — No prioritisation.** On a bad November day, satellites detect thousands of farm fires at once. A district has maybe a few dozen enforcement staff. Which fires do they visit? Right now, essentially nobody knows — because *most fires don't matter much to Delhi*. Wind direction decides that. A fire that's burning with the wind blowing away from population centres is far less urgent than a smaller one directly upwind. Nobody is doing that ranking.

---

## Part 2: What we're building

**VAAYU** is not a new sensor network, and it's not another pollution dashboard. It's the missing layer in between — it takes data that's already public and free, and turns it into specific instructions for specific people.

Think of it as the difference between a weather map and a cyclone warning. A weather map shows you conditions. A cyclone warning says: *this district, this timeframe, evacuate these areas.* We're building the second thing.

### The four things it does

**1. Fills in the blind spots — "what's the air like where there's no station?"**

We combine three ingredients: readings from real monitoring stations, satellite images that see haze from space, and weather data like wind and humidity. A machine learning model learns the relationship between all three, and then estimates air quality on a 1 km × 1 km grid — covering the entire map, including all the places with no station.

*Analogy:* it's like estimating house prices in a neighbourhood where only a few houses have sold. You use the known sales plus features you can observe about every house (size, location, age) to fill in the rest.

**2. Forecasts spikes 1–3 days ahead — "when is it going to get bad?"**

The same ingredients, plus weather *forecasts* and satellite fire detections, feed a model that predicts pollution levels 6, 24, and 72 hours ahead.

Why this matters legally: India's emergency air pollution rules (called GRAP — a staged set of restrictions like halting construction or banning certain vehicles) are now triggered **based on forecasts, not just current readings.** The committee that makes that call already wants exactly this kind of prediction. We're feeding a decision that's already being made.

**3. Ranks pollution sources by who they'll actually harm — "which fires do we go after?"**

We take today's fire detections, group them into clusters, and then trace where the smoke from each cluster will actually travel using wind data. Each cluster gets an **impact score** — based on how big the fire is, how many people live downwind, and how long the smoke takes to get there.

The output turns *"3,400 fires detected"* into *"these 12 clusters in these 4 tehsils will drive tomorrow's Delhi episode — send your teams here."*

This is the single most useful thing in the system, because it converts an unusable number into a to-do list.

**4. Lets citizens report what satellites miss**

Satellites pass overhead at fixed times — roughly 1:30 in the afternoon and again after midnight. Farmers have figured this out, and burning has shifted to evening hours to avoid detection. Independent field research found satellites picked up only **7 out of 169 fires** that were visible in high-resolution imagery.

So citizens can photograph what they see. An AI model looks at the photo and gives a rough air quality reading — *rough* being the important word (more on that below). We don't treat one photo as proof; we treat it as a hint that gets confirmed only when it lines up with other independent evidence.

---

## Part 3: The thing that makes this different

Most projects in this space stop at a nice-looking map. Ours has a rule:

> **An alert that doesn't name a law, an official, and an action isn't an alert. It's a chart.**

Every prediction the system makes ends up as a concrete message to a real decision-maker:

- **To the air quality commission:** "In 48 hours, air quality will hit 428 in Delhi-NCR. That's Stage III under the current rules. Stage III means: halt non-essential construction, close brick kilns, restrict older vehicles. Here's the legal reference. Here's how confident we are."

- **To a District Magistrate:** "Here are today's 12 highest-priority fire clusters in your district, ranked by how many people are downwind. Cluster PB-SGR-0412 has been flagged three days running with no recorded action — which makes it eligible for escalation under CAQM Direction 95."

- **To a citizen:** "Air quality in your area is estimated at X. There's no monitoring station near you — this is a model estimate with this much uncertainty. Here's what to do today."

The alert carries its own confidence level and lists exactly which data sources produced it. If an official acts on it, they can check the reasoning.

---

## Part 4: How it works, end to end

```
   Step 1: GATHER
   Government station readings · Satellite haze images · Satellite fire detections
   · Wind and weather data · Citizen photos
                          │
                          ▼
   Step 2: FILL IN THE MAP
   Model estimates air quality everywhere, not just at stations
                          │
                          ▼
   Step 3: LOOK AHEAD
   Model predicts 6h / 24h / 72h ahead
                          │
                          ▼
   Step 4: TRACE THE SOURCE
   Follow the wind backwards — which fires will actually reach people?
                          │
                          ▼
   Step 5: TURN IT INTO AN ORDER
   Prediction → legal restriction stage → named official → specific action
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
      Officials' console        Citizens' app
      (what to do, where)       (what's my air, what should I do)
```

---

## Part 5: Where the data comes from

Everything is free and public. This matters for two reasons: the project is reproducible by anyone, and it can be given away as a public good rather than sold.

| What we need | Where it comes from |
|---|---|
| Ground truth air readings | India's Central Pollution Control Board, via the government's open data portal |
| Haze seen from space | NASA and European Space Agency satellites |
| Farm fire detections | NASA's fire monitoring system, updated roughly every 3 hours |
| Wind, humidity, temperature | European weather reanalysis + US forecast models |
| Population maps | Open global population datasets |

One honest note: many projects quietly scrape an unofficial government endpoint that isn't meant for public use and breaks regularly. We use the officially sanctioned open data route instead, even though it's slightly less convenient.

---

## Part 6: What we're deliberately *not* claiming

This section exists because overclaiming is the fastest way to lose credibility with anyone who knows the field. Every number below is an honest ceiling, not a hedge.

**We can't tell you the exact air quality from a photograph.** The best published research gets roughly 60% accuracy on this, and it degrades badly depending on camera, lighting, and time of day. Clouds get mistaken for haze. So photos give a *rough band* — good, moderate, poor — never a precise number.

**Our map estimates have real uncertainty.** Published studies in India report accuracy varying widely by region and season. We report the honest number, including the harder test where we hide an entire monitoring station from the model and see if it can still predict that location correctly. That test always gives a worse result than the easy test — and most projects only report the easy one.

**Satellites can't see through clouds,** and oddly, they also struggle during extremely heavy pollution. So there are gaps. We show where the gaps are instead of quietly filling them in.

**We're not simulating atmospheric chemistry.** The full physics simulations used by government forecasting centres need supercomputers. We use statistical models instead, and we say so.

**We can't fully solve night burning.** It's a physical limit of when satellites pass overhead. Citizen reports help. They don't eliminate it.

---

## Part 7: What the demo will show

Five things, in order:

1. **A map that reveals a hotspot nobody was measuring** — high pollution in an area with no monitoring station nearby.
2. **A forecast, shown next to the naive guess it beats** — proving the model adds real value, not just producing a chart.
3. **The full chain in one flow:** fire detections → wind trace → impact ranking → an alert that names the legal stage, the jurisdiction, and the required action.
4. **A citizen photo turning into an air quality estimate,** with its confidence honestly displayed.
5. **Data pulled live from multiple countries,** showing the cross-border piece works — including openly flagging that Russia publishes no accessible real-time data, so that gap is stated rather than hidden.

---

## Part 8: What success looks like

**Short term (pilot):** deployed in one district with a named official contact. The measurable question isn't model accuracy — it's whether alerts got opened, whether they got acted on, and whether action correlated with less severe pollution afterwards.

**Medium term:** national coverage, plus integration of India's growing low-cost sensor networks.

**Long term:** a second country joins, and the platform becomes a certified public good — free, open, and adoptable by any nation with the same problem.

---

## The honest pitch, in four sentences

The data to solve this is already public. The legal power to act on it already exists. The people to enforce it are already hired. What's missing is the layer that turns a satellite image into a specific instruction for a specific officer on a specific day — and that's the only thing we're building.
