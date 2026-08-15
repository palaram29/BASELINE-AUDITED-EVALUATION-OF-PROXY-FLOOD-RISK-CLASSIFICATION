# ML Methodology and Limitations

This document is the single source of truth for how `Flood_Risk` is
defined, how the dataset is built, and how the three models are trained
and compared. It replaces an earlier version of this document that
described a same-day, rainfall-threshold-derived label; that version's
findings are summarized in §1 as the reason this methodology exists.

---

## 1. The original problem: ~99.9% accuracy that wasn't measuring anything useful

An earlier version of this system trained Random Forest, XGBoost and
LightGBM to classify `Flood_Risk` from same-day `Rainfall_3Day`,
`Avg_Temperature`, `Avg_WindSpeed`, `Elevation` and `City`, and all three
scored 99.05-99.94% accuracy. Investigation found two compounding causes:

- **Class imbalance**: the original label was 99.5% "Low", 0.41%
  "Medium", 0.08% "High", 0.01% "Extreme". A classifier that always
  predicts "Low" already scores ~99.4% without learning anything.
- **The label was a near-deterministic function of one input**: a plain
  rainfall-threshold rule (`<150mm -> Low`, `<200 -> Medium`, `<350 ->
  High`, else `Extreme`), with no machine learning at all, reproduced the
  original `Flood_Risk` column at 99.8% accuracy on both train and test.
  Random Forest's own feature importance assigned 85.6% of its decision
  weight to `Rainfall_3Day` alone.

No script that generated the original `Flood_Risk` column was ever found
in this repository (it isn't tracked by git - see `.gitignore`), so its
exact provenance is unknown. The statistical fingerprint above is
conclusive regardless: the model was recovering a labeling formula, not
learning to forecast flood risk.

## 2. New methodology: next-day (t+1) forecasting from a documented, multi-factor derived index

The ML task is now: **predict `Flood_Risk` for day `t+1` using only
information available at day `t`.** This is a deliberate reframe from
same-day classification to genuine forecasting - see §5 for why, and §12
for what this changed about the results.

### 2.1 The target is a derived index, not an observed flood label

**`Flood_Risk` is a derived flood-risk index, not an observed or
confirmed flood event.** No historical flood-incident record exists
anywhere in this project. Every piece of documentation, API response,
and dashboard string describing this target must say "predicted
flood-risk index" / "forecasted risk" / "derived risk", never "flood
prediction accuracy" or "confirmed flood" unqualified. Real,
authoritative flood status *is* collected by this system - see §16 (DMC
river data, Phase 2) - but not yet in enough historical depth to serve
as a training label.

### 2.2 Historical feature set

```
City, Rainfall_3Day, Avg_Temperature, Avg_WindSpeed, Elevation, Coastal_Flag
```

`Rainfall_1Day`, `Distance_to_River`, and `River_Water_Level` are
excluded from the historical (2010-2023) dataset because the daily-
granularity data they'd require doesn't exist for that period anywhere
in this project - no daily rainfall record survives before the 3-day
rolling sums were computed, and DMC river-gauge collection (see §16)
only holds a handful of days. Nothing was approximated or invented to
fill this gap; the features were simply left out. They are re-evaluated
once enough live daily history accumulates (Phase 2).

`Coastal_Flag` (`ML/utils.py`'s `COASTAL_MAP`) is a new static per-city
lookup based on general published geography of these 30 named towns, not
a surveyed gazetteer. `Mabole` is the single lowest-confidence entry (a
Wattala-area suburb a few km inland of the Negombo-lagoon coast) and is
worth independent verification if its exact classification matters for
a specific analysis.

## 3. Hazard x Vulnerability label formula

```
Hazard(t+1)      = normalized(Rainfall_3Day(t+1)), clipped to [0, 1]
Vulnerability    = 0.5 x InverseElevation + 0.5 x Coastal_Flag
InverseElevation = 1 - clip(normalized_elevation, 0.05, 0.95)
RiskScore(t+1)   = Hazard(t+1) x Vulnerability
Flood_Risk(t+1)  = global percentile classification of RiskScore(t+1)
```

As fit by `ML/prepare_dataset.py` on the primary 2010-2019 training
period:

| Component | Fitted value |
|---|---|
| Rainfall_3Day normalization | min = 0.0, max = 527.9 |
| Elevation normalization | min = 2.0 (Negombo), max = 1271.0 (Hatton), clipped to [0.05, 0.95] before inverting |

**Elevation clipping exists to fix a concrete bug found during
methodology review**: without clipping, Hatton (the maximum-elevation
city) maps to `normalized_elevation = 1.0` exactly, giving
`InverseElevation = 0` and, since Hatton is inland, `Vulnerability = 0`
- meaning Hatton would be classified "Low" risk regardless of rainfall,
by construction rather than evidence. Clipping to [0.05, 0.95] ensures
no city can reach exactly 0 or 1.

**Weights are equal (0.5/0.5) because no historical flood inventory or
expert panel exists to fit differential weights** (the two standard
methods in the flood-susceptibility literature - AHP pairwise comparison
and frequency-ratio analysis - both require data this project doesn't
have). Equal weighting is the documented default for this situation, not
a literature-derived number; treat any specific weight ratio here as a
stated simplification, not a citation.

## 4. Global percentile classification (not per-city)

**Percentile thresholds are fit on the training period's RiskScore,
pooled across all 30 cities, and applied unchanged to every row (train
and test).** This was a required fix from methodology review: an earlier
per-city design (each city's own top 0.5%/1.5%/3% -> Extreme/High/
Medium) was rejected because multiplying a city's entire RiskScore
series by that city's own constant `Vulnerability` does not change
within-city percentile rank at all - `Elevation` and `Coastal_Flag`
would have had **zero actual effect** on the label under a per-city
scheme, despite being the entire reason they were added. Global
thresholds fix this and also avoid forcing every city (wet or dry) into
the same fixed proportion of severe days.

Approved boundaries and their fitted RiskScore cutoffs (training period):

| Class | Percentile | Fitted RiskScore cutoff |
|---|---|---|
| Extreme | top 0.5% | >= 0.1984 |
| High | 98.0-99.5% | >= 0.1206 |
| Medium | 95.0-98.0% | >= 0.0824 |
| Low | bottom 95.0% | below 0.0824 |

Resulting class distribution (measured, not assumed):

| Class | Train count | Train % | Test count | Test % |
|---|---:|---:|---:|---:|
| Low | 103,992 | 94.996% | 36,183 | 95.495% |
| Medium | 3,278 | 2.994% | 1,172 | 3.093% |
| High | 1,652 | 1.509% | 447 | 1.180% |
| Extreme | 548 | 0.501% | 88 | 0.232% |

This is a materially healthier distribution than the original label (548
Extreme training examples vs. 8 previously; 88 Extreme test examples vs.
15 across the *entire* old dataset combined) - a direct, measured
consequence of the global-threshold fix, not a target chosen to produce
this outcome.

## 5. Why forecast t+1 instead of classify same-day

An early-warning system that reports today's already-known rainfall
isn't a warning - it has no lead time. `X(t) -> Y(t+1)` requires the
model to forecast risk before the triggering rainfall is fully observed,
which is the actual operational task. Mechanically: for each city, rows
are sorted by `End_Date`; `X(t)` is one row's features, `Y(t+1)` is the
*next* row's `Flood_Risk`Rather than either row leaking into the other's
own column set.

**This means the model is implicitly trying to forecast next-day
rainfall accumulation**, since `Vulnerability` is static and already
fully known at `t` - the only genuinely new information in `Y(t+1)` is
`Rainfall_3Day(t+1)`. This is stated explicitly rather than hidden: any
skill the models show is bounded by how forecastable near-term rainfall
accumulation is from antecedent conditions, which is a real and only
partially solvable meteorological problem - see §7 for why this is not
as strong a task as it first appears.

## 6. Processing order (leakage prevention)

```
1. Load raw historical data (ML/data/raw_historical_{train,test}.csv)
2. Parse dates
3. Combine into one historical pool (the original interleaved split is
   not usable for a chronological task)
4. Sort by City, End_Date
5. Chronological train/test boundary (year, not shuffled)
6. Fit rainfall normalization on TRAINING PERIOD Rainfall_3Day only
7. Compute Hazard using that fitted normalization, applied to all rows
8. Compute Vulnerability (static per-city lookup, no fitting needed)
9. Compute RiskScore = Hazard x Vulnerability
10. Fit GLOBAL percentile thresholds on TRAINING PERIOD RiskScore only
11. Apply the same fixed thresholds to every row (train and test)
12. Build t -> t+1 pairs per city (shift label back one day)
13. Drop each city's final row (no t+1 available)
14. Drop the one pair per city whose t+1 crosses the train/test boundary
```

Implemented in `ML/prepare_dataset.py`. Validated directly against the
output: 0 missing values, 0 duplicate rows in either split, train dates
run 2010-01-03 to 2019-12-30, test dates run 2020-01-01 to 2023-06-16,
with no row in either split crossing into the other's year range.

## 7. Rolling-window overlap - a structural limitation, not a bug

**`Rainfall_3Day(t)` and `Rainfall_3Day(t+1)` share two of their three
summed days by construction** (`R(t-2)+R(t-1)+R(t)` vs.
`R(t-1)+R(t)+R(t+1)`). Measured directly on this dataset: the mean
correlation between `Rainfall_3Day(t)` and `Rainfall_3Day(t+1)` across
all 30 cities is **r ~ 0.85** (range 0.83-0.89). This is not ordinary
weather persistence - it's partly arithmetic, because two of the three
days being summed are literally identical values. `Rainfall_1Day` is
unavailable historically (§2.2), so this overlap cannot currently be
removed from the 3-day-window design.

**Consequence, confirmed by the actual results (§11-12): the persistence
baseline (`Flood_Risk(t+1) = Flood_Risk(t)`) is unusually strong here**,
and any claim of model skill must be read relative to it, not relative
to accuracy alone.

## 8. Class imbalance handling

- **Random Forest**: `class_weight="balanced"` (constructor).
- **LightGBM**: `class_weight="balanced"` (constructor).
- **XGBoost**: no native multiclass `class_weight`; a balanced
  `sample_weight` vector, computed via
  `sklearn.utils.class_weight.compute_sample_weight("balanced", y_train)`
  (training labels only, never test labels), is passed at `.fit()` time.

SMOTE was not used: interpolating between two real weather rows produces
rainfall/temperature/windspeed combinations that never physically
occurred, which would corrupt exactly the minority classes it's meant to
help.

## 9. Train/test split

**Primary**: chronological, per city, `End_Date` year <= 2019 -> train,
>= 2020 -> test. No shuffling. 109,470 train pairs, 37,890 test pairs.
The single boundary-straddling pair per city (t = 2019-12-31, t+1 =
2020-01-01) is dropped from both splits.

**Secondary (mandatory)**: walk-forward validation across 6 folds
(`ML/walkforward_validate.py`), each fold refitting rainfall
normalization and global percentile thresholds on that fold's own
training period only:

```
Train 2010-2016 -> Test 2017
Train 2010-2017 -> Test 2018
Train 2010-2018 -> Test 2019
Train 2010-2019 -> Test 2020
Train 2010-2020 -> Test 2021
Train 2010-2021 -> Test 2022
```

## 10. Baselines

- **Majority**: always predicts the training set's most common class.
- **Persistence**: predicts `Flood_Risk(t+1) = Flood_Risk(t)`, using
  each row's own `Flood_Risk_Previous_Day` column - no environmental
  features, no training data.
- **Seasonal**: most common `Flood_Risk` per (City, calendar month) in
  training data only, applied to test rows by their own City/month; an
  unseen City/month combination falls back to the overall training
  majority class.

## 11. Primary split results (2010-2019 train / 2020-2023 test)

All values below are the actual output of `ML/train_models.py` against
the dataset described in §4 - none are estimated.

| Model | Accuracy | Macro-F1 | Macro Precision | Macro Recall | Weighted F1 | High Recall | Extreme Recall | ROC-AUC |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Majority Baseline | 0.9549 | 0.2442 | 0.2387 | 0.2500 | 0.9329 | 0.0000 | 0.0000 | - |
| Persistence Baseline | 0.9613 | **0.6307** | 0.6307 | 0.6307 | 0.9613 | 0.4922 | 0.5682 | - |
| Seasonal Baseline | 0.9549 | 0.2442 | 0.2387 | 0.2500 | 0.9329 | 0.0000 | 0.0000 | - |
| Random Forest | 0.9606 | 0.5359 | 0.5959 | 0.5054 | 0.9540 | 0.3669 | 0.4432 | 0.9363 |
| XGBoost | 0.9014 | 0.5194 | 0.4676 | 0.6492 | 0.9252 | 0.4944 | 0.5341 | 0.9600 |
| **LightGBM (selected)** | 0.9064 | 0.5221 | 0.4680 | 0.6493 | 0.9281 | **0.4944** | **0.5568** | 0.9595 |

**Persistence beats all three trained models on macro-F1.** This is the
single most important, and least comfortable, finding in this document
- see §12.

## 12. What the results actually show - reported honestly, not adjusted

Per this project's explicit rule (do not tune the methodology to chase a
particular accuracy number), the result above is reported as measured:

- None of Random Forest, XGBoost or LightGBM beat the persistence
  baseline's macro-F1 (0.6307) in the primary split, and **the same
  pattern holds in every one of the 6 walk-forward folds without
  exception** (§13) - this is not a one-off artifact of the 2020-2023
  test window.
- This is consistent with, and largely explained by, the §7 finding:
  with ~0.85 correlation between consecutive `Rainfall_3Day` windows
  baked into the feature/target relationship by construction, "assume
  tomorrow looks like today" is a very hard baseline to beat using only
  a 3-day rolling accumulation as the rainfall signal.
- What the class-imbalance fix (§8) demonstrably did work: LightGBM's
  ROC-AUC recovered from 0.51 (near-random, under the old unweighted
  same-day setup) to 0.96, and High/Extreme recall are no longer zero
  for any of the three trained models.
- **Honest interpretation**: at a 1-day lead time, with only 3-day
  rolling rainfall accumulation (no daily rainfall, no river level yet
  available), these three tree-ensemble models do not add forecasting
  value beyond naive persistence for this derived risk index. This is a
  legitimate, reportable research finding - not a failed experiment -
  and points directly at the two concrete next steps in §16: shorter/
  higher-resolution rainfall features and real river-level data, both
  gated on data that isn't in this project yet.

## 13. Walk-forward validation results

Mean across the 6 folds (`ML/reports/walkforward_results.csv` has the
per-fold breakdown):

| Model | Mean Accuracy | Mean Macro-F1 | Mean High Recall | Mean Extreme Recall |
|---|---:|---:|---:|---:|
| Majority Baseline | 0.9536 | 0.2440 | 0.0000 | 0.0000 |
| **Persistence Baseline** | 0.9595 | **0.6170** | 0.4906 | 0.5441 |
| Seasonal Baseline | 0.9536 | 0.2440 | 0.0000 | 0.0000 |
| Random Forest | 0.9582 | 0.5319 | 0.3925 | 0.4262 |
| XGBoost | 0.8944 | 0.5252 | 0.4864 | 0.5340 |
| LightGBM | 0.9015 | 0.5254 | 0.5034 | 0.5368 |

Persistence has the highest macro-F1 in every individual fold as well as
in the mean - confirming §11-12 is not specific to the 2020-2023 window.

## 14. Model selection

Rule: primary = macro-F1; models within 0.02 of the top macro-F1 are
treated as tied, and among those, a model beating the macro-F1 leader's
High-risk recall by >= 0.05 is preferred (falling back to Extreme-risk
recall as a second tie-break). Implemented in
`ML/model_selector.py::select_best_model`.

Applied to §11's results: Random Forest has the highest raw macro-F1
(0.5359), but LightGBM is within the 0.02 tie margin (0.5221) and beats
Random Forest's High-risk recall by 0.1275 (0.4944 vs. 0.3669) - well
over the 0.05 margin. **LightGBM was selected** on this basis, not on
accuracy (LightGBM's accuracy, 0.9064, is in fact the lowest of the
three trained models - a direct illustration of why accuracy is not the
selection metric).

## 15. Evaluation metrics reported

**Primary**: Macro-F1, High-risk recall, Extreme-risk recall.
**Secondary**: Accuracy, macro precision, macro recall, weighted F1,
per-class precision/recall (`ML/reports/metrics.json`'s
`classification_report`), confusion matrix
(`ML/reports/confusion_matrices/`), ROC-AUC (OVR, weighted).

## 16. DMC river-gauge data - Phase 2 plan

`backend/extract_river_data.py` already scrapes Sri Lanka's Disaster
Management Centre daily river-gauge PDF report, carrying official
`AlertLevel`/`MinorFloodLevel`/`MajorFloodLevel` per station and a
DMC-assigned `Status` (Normal/Alert/Minor Flood/Major Flood) - genuine,
authoritative flood-status data, not synthetic. As of this writing only
a handful of snapshots exist (`extracted_data/`), and no station-to-city
mapping exists in the backend (only partial, approximate coordinates in
the frontend map). Phase 2, once enough history accumulates:

1. Build a real station-to-city mapping.
2. Keep the DMC scraper running continuously so history accrues.
3. Add `River_Water_Level`/an alert-level ratio as both an ML feature
   and, potentially, a real (not derived) validation signal for the
   synthetic `RiskScore`.
4. Add `Rainfall_1Day` once enough daily-granularity weather history
   exists to support it historically.

## 17. Research limitations (state explicitly in the dissertation)

1. `Flood_Risk` is a derived index (Hazard x Vulnerability, §3), not an
   observed flood-event label - no historical flood-incident inventory
   exists anywhere in this project.
2. Equal (0.5/0.5) Hazard/Vulnerability weighting is a documented
   default, not a literature-fitted or expert-elicited value.
3. `Vulnerability` uses only Elevation and Coastal_Flag - a simplified
   subset of the fuller factor sets (slope, drainage density, distance-
   to-river, land use) used in dedicated GIS flood-susceptibility
   studies, due to data availability, not oversight.
4. `Coastal_Flag` is based on general geography, not a surveyed
   gazetteer (see §2.2's note on `Mabole`).
5. The 3-day rolling-window construction (§7) structurally inflates
   apparent 1-day-ahead forecast skill via literal day-overlap between
   `Rainfall_3Day(t)` and `Rainfall_3Day(t+1)` (r ~ 0.85) - all reported
   model performance should be read relative to the persistence
   baseline, not in isolation.
6. **None of the three trained models beat the persistence baseline on
   macro-F1**, in the primary split or in any of the 6 walk-forward
   folds (§11-13) - reported as measured, not adjusted.
7. `River_Water_Level` and `Rainfall_1Day` are unavailable for the
   2010-2023 historical period and are excluded, not approximated.
8. `Extreme` remains a minority class even after the global-percentile
   redesign (548 train / 88 test examples) - a large improvement over
   the original label (8 train / 7 test) but still statistically small.
