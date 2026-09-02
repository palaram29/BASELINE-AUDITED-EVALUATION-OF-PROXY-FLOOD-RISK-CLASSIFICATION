# ML Methodology and Limitations

This document is the single source of truth for how `Flood_Risk` is
defined, how the dataset is built, and how the three models are trained
and compared. §1 records the original same-day, rainfall-threshold label
and why it was abandoned; §2 onward is the current methodology.

For the `ML/` code that implements all of this, see
[ML_PIPELINE.md](ML_PIPELINE.md).

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
authoritative flood status _is_ collected by this system - see §16 (DMC
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

| Component                   | Fitted value                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------ |
| Rainfall_3Day normalization | min = 0.0, max = 527.9                                                               |
| Elevation normalization     | min = 2.0 (Negombo), max = 1271.0 (Hatton), clipped to [0.05, 0.95] before inverting |

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

| Class   | Percentile   | Fitted RiskScore cutoff |
| ------- | ------------ | ----------------------- |
| Extreme | top 0.5%     | >= 0.1984               |
| High    | 98.0-99.5%   | >= 0.1206               |
| Medium  | 95.0-98.0%   | >= 0.0824               |
| Low     | bottom 95.0% | below 0.0824            |

Resulting class distribution (measured, not assumed):

| Class   | Train count | Train % | Test count |  Test % |
| ------- | ----------: | ------: | ---------: | ------: |
| Low     |     103,992 | 94.996% |     36,183 | 95.495% |
| Medium  |       3,278 |  2.994% |      1,172 |  3.093% |
| High    |       1,652 |  1.509% |        447 |  1.180% |
| Extreme |         548 |  0.501% |         88 |  0.232% |

This is a materially healthier distribution than the original label (548
Extreme training examples vs. 8 previously; 88 Extreme test examples vs.
15 across the _entire_ old dataset combined) - a direct, measured
consequence of the global-threshold fix, not a target chosen to produce
this outcome.

## 5. Why forecast t+1 instead of classify same-day

An early-warning system that reports today's already-known rainfall
isn't a warning - it has no lead time. `X(t) -> Y(t+1)` requires the
model to forecast risk before the triggering rainfall is fully observed,
which is the actual operational task. Mechanically: for each city, rows
are sorted by `End_Date`; `X(t)` is one row's features and `Y(t+1)` is
the _next_ row's `Flood_Risk`, rather than either row leaking into the
other's own column set.

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

> = 2020 -> test. No shuffling. 109,470 train pairs, 37,890 test pairs.
> The single boundary-straddling pair per city (t = 2019-12-31, t+1 =
> 2020-01-01) is dropped from both splits.

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

### 9.1 Hyperparameter selection (validation-only)

Hyperparameters are selected **inside the training period only**. The
training years are split again into an inner training period (2010-2017)
and a validation period (2018-2019). Six candidate configurations per
algorithm are fitted on the inner training period and scored on the
validation period by macro-F1 (`ML/tune_hyperparameters.py`). The winning
configuration per algorithm is then transcribed by hand into
`ML/model_selector.py`, refitted on the full 2010-2019 training period,
and only then evaluated on the 2020-2023 test period, once.

The 2020-2023 test period is not read, scored or inspected at any point
during selection. It is a locked final holdout, opened after the
configuration is fixed.

The full search, all eighteen candidates with their validation scores and
the selected row flagged, is recorded in
`ML/reports/hyperparameter_search.csv` so the selection can be audited
without rerunning it.

**Selected configurations** (see `ML/model_selector.py`):

| Model        | Configuration                                                          | Validation macro-F1 |
| ------------ | ---------------------------------------------------------------------- | ------------------: |
| RandomForest | `max_depth=20, min_samples_leaf=2`                                     |              0.5778 |
| XGBoost      | `max_depth=5, min_child_weight=5, subsample=0.8, colsample_bytree=0.8` |              0.5147 |
| LightGBM     | `max_depth=10, min_child_samples=30`                                   |              0.5175 |

All three use `n_estimators=100` and `random_state=42`; XGBoost and
LightGBM use `learning_rate=0.1`. RandomForest and LightGBM use
`class_weight="balanced"`; XGBoost receives an equivalent balanced
`sample_weight` computed from `y_train` at fit time.

**Note on an earlier version of this pipeline.** A previous
configuration was chosen by comparing candidates on the test period and
preferring the option that narrowed the train/test macro-F1 gap. That is
test-guided model selection, and it made the reported comparison
unreliable regardless of how the resulting numbers looked. The procedure
was replaced with the validation-only protocol described above and every
model was reselected and re-evaluated from scratch. This note is kept
deliberately rather than deleted, because the project's rule is to record
what was actually done, including the parts that had to be corrected.

### 9.2 Residual train/test gap

Selection now optimises validation macro-F1, not the size of the
train/test gap. The selected RandomForest therefore retains a
train/test macro-F1 gap of roughly 0.31. This is reported as a
limitation of the selected model rather than presented as a quantity the
methodology controlled, since controlling it was what produced the
leakage described above.

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

| Model                        | Accuracy |   Macro-F1 | Macro Precision | Macro Recall | Weighted F1 | High Recall | Extreme Recall | ROC-AUC |
| ---------------------------- | -------: | ---------: | --------------: | -----------: | ----------: | ----------: | -------------: | ------: |
| Majority Baseline            |   0.9549 |     0.2442 |          0.2387 |       0.2500 |      0.9329 |      0.0000 |         0.0000 |       - |
| Persistence Baseline         |   0.9613 | **0.6307** |          0.6307 |       0.6307 |      0.9613 |      0.4922 |         0.5682 |       - |
| Seasonal Baseline            |   0.9549 |     0.2442 |          0.2387 |       0.2500 |      0.9329 |      0.0000 |         0.0000 |       - |
| **Random Forest (selected)** |   0.9496 | **0.5780** |          0.5533 |       0.6106 |      0.9531 |      0.4183 |         0.5682 |  0.9519 |
| XGBoost                      |   0.8954 |     0.5308 |          0.4780 |       0.6693 |      0.9218 |      0.4944 |         0.6023 |  0.9620 |
| LightGBM                     |   0.9056 |     0.5170 |          0.4660 |       0.6382 |      0.9276 |      0.4676 |         0.5455 |  0.9597 |

ROC-AUC above is one-versus-rest under **weighted** averaging, which is
what the dashboard and manifest have always reported. Macro-averaged
one-versus-rest AUC is now computed alongside it
(`ML/reports/metrics.json`, `roc_auc_macro`): 0.9478 for Random Forest,
0.9542 for XGBoost, 0.9530 for LightGBM. Both are recorded because
weighted averaging is support-weighted and therefore dominated by the
Low class, which holds roughly 95% of the rows; macro averaging gives
each of the four classes equal weight and is the figure comparable to
macro-F1. Either way, AUC on this target is far above macro-F1 because
AUC scores the full probability ranking while macro-F1 depends on the
thresholded decisions actually issued, so a high AUC here should not be
read as usable warning performance.

All three algorithms are regularized through `max_depth` and minimum-leaf
constraints. Those constraints were chosen on the validation period held
out from within the training years, never on the test period; see §9.1 for
the protocol and `ML/reports/hyperparameter_search.csv` for the full
candidate list and scores.

Random Forest's macro-F1 (0.5780) leads XGBoost's (0.5308) and LightGBM's
(0.5170) by more than the 0.02 tie margin, so Random Forest is selected
on macro-F1 alone (`ML/reports/production_model.json`, version 1.1).

**Persistence still beats all three trained models on macro-F1** (0.5780
best-of-three vs. persistence's 0.6307). This is the single most
important, and least comfortable, finding in this document — see §12.

## 12. What the results actually show - reported honestly, not adjusted

Per this project's explicit rule (do not tune the methodology to chase a
particular accuracy number), the result above is reported as measured:

- None of Random Forest, XGBoost or LightGBM beat the persistence
  baseline's macro-F1 (0.6307) in the primary split, and **the same
  pattern holds in 5 of the 6 walk-forward folds** (§13), so this is not
  a one-off artifact of the 2020-2023 test window. The single exception
  is the 2018 fold, where Random Forest reaches 0.6054 against
  persistence's 0.5857.
- This is consistent with, and largely explained by, the §7 finding:
  with ~0.85 correlation between consecutive `Rainfall_3Day` windows
  baked into the feature/target relationship by construction, "assume
  tomorrow looks like today" is a very hard baseline to beat using only
  a 3-day rolling accumulation as the rainfall signal.
- What the class-imbalance fix (§8) demonstrably did work: High and
  Extreme recall are non-zero for all three trained models, and macro
  recall sits above macro precision for the selected Random Forest
  (0.6106 against 0.5533), which is the expected shape for a
  class-weighted model in a warning setting where a missed event costs
  more than a false alarm. An earlier note here compared LightGBM's
  ROC-AUC against a near-random 0.51 under an unweighted same-day setup;
  that configuration no longer exists in the pipeline and the comparison
  is not reproducible from the current code, so it has been removed
  rather than carried forward unverified.
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

| Model                    | Mean Accuracy | Mean Macro-F1 | Mean High Recall | Mean Extreme Recall |
| ------------------------ | ------------: | ------------: | ---------------: | ------------------: |
| Majority Baseline        |        0.9536 |        0.2440 |           0.0000 |              0.0000 |
| **Persistence Baseline** |        0.9595 |    **0.6170** |           0.4906 |              0.5441 |
| Seasonal Baseline        |        0.9536 |        0.2440 |           0.0000 |              0.0000 |
| Random Forest            |        0.9458 |        0.5771 |           0.4565 |              0.4975 |
| XGBoost                  |        0.8890 |        0.5409 |           0.5115 |              0.5918 |
| LightGBM                 |        0.9016 |        0.5366 |           0.5038 |              0.5748 |

Persistence has the highest macro-F1 in the mean and in 5 of the 6
individual folds, confirming §11 and §12 are not specific to the
2020-2023 test window. The exception is the 2018 fold (train through
2017), where Random Forest reaches 0.6054 against persistence's 0.5857.
The per-fold ranking is printed by `ML/walkforward_validate.py` at the
end of its run so the claim can be checked directly rather than read off
the table.

## 14. Model selection

Rule: primary = macro-F1; models within 0.02 of the top macro-F1 are
treated as tied, and among those, a model beating the macro-F1 leader's
High-risk recall by >= 0.05 is preferred (falling back to Extreme-risk
recall as a second tie-break). Implemented in
`ML/model_selector.py::select_best_model`.

Applied to §11's results: Random Forest has the highest raw macro-F1
(0.5780), and neither XGBoost (0.5308) nor LightGBM (0.5170) is within
the 0.02 tie margin of it (they trail by 0.047 and 0.061), so the tie-break rule
never activates — **Random Forest is selected outright on macro-F1**,
with no recall-based override needed. The frozen artifact is
`ML/models/best_model.pkl`; its manifest is
`ML/reports/production_model.json` (version 1.1).

## 15. Evaluation metrics reported

**Primary**: Macro-F1, High-risk recall, Extreme-risk recall.
**Secondary**: Accuracy, macro precision, macro recall, weighted F1,
per-class precision/recall (`ML/reports/metrics.json`'s
`classification_report`), confusion matrix
(`ML/reports/confusion_matrices/`), ROC-AUC (OVR) under both weighted
and macro averaging, impurity-based and permutation feature importance,
and block-bootstrap confidence intervals against the persistence
baseline (`ML/compute_statistics.py` ->
`ML/reports/uncertainty_analysis.json`).

## 16. DMC river-gauge data - Phase 2 plan

`backend/extract_river_data.py` already scrapes Sri Lanka's Disaster
Management Centre daily river-gauge PDF report, carrying official
`AlertLevel`/`MinorFloodLevel`/`MajorFloodLevel` per station and a
DMC-assigned `Status` (Normal/Alert/Minor Flood/Major Flood) - genuine,
authoritative flood-status data, not synthetic. As of this writing only
a handful of snapshots exist (`extracted_data/`). Only a partial,
best-effort station-to-city mapping exists so far
(`backend/services/reliability_service.py::CITY_TO_RIVER_STATION_MAP`,
used by the reliability layer), plus approximate coordinates in the
frontend map. Phase 2, once enough history accumulates:

1. Build a complete, verified station-to-city mapping.
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

## 18. Production deployment: frozen model policy

The live system (weather/river ingestion -> feature processing -> ML
prediction -> dashboard/map) uses a **frozen** production model, not a
continuously-retrained one.

The monitoring evidence layer that supports this policy — feature drift,
data-quality, and prediction-distribution monitoring, the model-version
registry, and human-triggered promotion/rollback — is implemented in
`backend/services/mlops_service.py` / `backend/routes/mlops.py`, backed
by the `ml_*` Postgres tables and surfaced on the console's MLOps page.
See [MLOPS.md](MLOPS.md). It turns "a
human decides to retrain" into "a human decides to retrain, informed by a
drift alert" — it does not replace the decision with automation.

- Training happens **offline only**, by a human running
  `python ML/train_models.py` against the historical dataset described
  above. This is the only code path that fits a model.
- After the three algorithms are compared, `ML/train_models.py` writes
  `ML/reports/production_model.json` - a manifest recording the selected
  model's name, a version number, `"status": "frozen"`, the exact
  feature list, training/test dataset date ranges, and the evaluation
  metrics that justified the selection (§14's hierarchy: macro-F1
  primary, High/Extreme-risk recall as tie-breaks).
- The live API (`backend/routes/ml.py`, `backend/services/ml_service.py`)
  only ever **reads** `ML/models/best_model.pkl` and this manifest to
  score incoming live weather features - there is no training or
  retraining endpoint. `POST /ml/train` (and the frontend's former
  "Retrain Models" button) were removed for this reason; a model change
  now requires a deliberate offline re-run of `ML/train_models.py`
  followed by a human reviewing the new metrics before redeployment.
- The live prediction target is unchanged from §2-§5 above: a next-day
  (t+1) forecast of the same derived `Flood_Risk` index, scored against
  the latest `Rainfall_3Day`/`Avg_Temperature`/`Avg_WindSpeed` on record
  for a city plus its static `Elevation`/`Coastal_Flag`. Live river-gauge
  data (`river_data`) is surfaced on the dashboard/map as an **observed**
  reading, presented separately from the ML prediction (see the map's
  "Observed river stations" vs. "ML flood-risk prediction" layers) - it
  is not yet an ML input feature, since no historical river-gauge archive
  exists to train against (§16's Phase 2 remains the path to changing
  that, and would itself require a new offline training run, not a live
  retrain).

## 19. Same-day ("Today") risk index - rule-based, not ML

The console and citizen app show a **Today / Tomorrow** toggle. "Tomorrow"
is the frozen t+1 ML model described above, unchanged. "Today" is a
**deterministic rule**, not a model:

```
Hazard(t)     = clip((Rainfall_3Day(t) - rmin) / (rmax - rmin), 0, 1)
RiskScore(t)  = Hazard(t) x Vulnerability(city)          # §3 formula, un-shifted
Risk_Level(t) = global-percentile classification of RiskScore(t)   # §4 thresholds
```

It reuses the **exact §3 Hazard x Vulnerability construction and the §4
global percentile thresholds** - the only difference from the training
label is that it is _not_ shifted to t+1 (§6 step 12). Per §5, the
same-day RiskScore needs no forecast: `Vulnerability` is static and
`Rainfall_3Day(t)` is already observed.

- **Frozen parameters.** `rmin`/`rmax`, the three RiskScore thresholds,
  and the per-city `Vulnerability` are written once, offline, by
  `python ML/export_label_params.py` to
  `ML/reports/label_construction.json` (fit on the 2010-2019 training
  period, from `ML/data/processed_dataset.csv`). Re-run that script only
  when `ML/prepare_dataset.py` itself changes. Per-city `Vulnerability`
  is taken from the processed dataset (which used the raw historical
  `Elevation` column), _not_ recomputed from `ML/utils.py::ELEVATION_MAP`,
  so the index matches the frozen model's own labels.
- **No model touched.** `backend/services/live_risk_service.py` never
  loads `best_model.pkl` or any encoder. There is **no
  probability/confidence** output - a rule has none. Data Source
  Reliability is attached the same additive way as on t+1 predictions.
- **Storage.** Each pipeline run upserts one row per city into
  `live_risk_results` (keyed by `("Date","City")`), the direct parallel
  of `prediction_results`. Served by `GET /prediction/live` (current) and
  `GET /prediction/live/history` (snapshots), and included as the
  `live_risk` key on `GET /dashboard`.
- **Why keep it rule-based.** Fitting a second ML model to this un-shifted
  label would just relearn a near-deterministic function of rainfall
  (~99% accuracy) - the exact circularity §1 documents. The rule is
  honest about what it is: a current-conditions exposure index.
