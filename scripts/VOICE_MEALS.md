# Voice meal logging (Mini Lorne procedure, app v20)

Lorne says what he ate (voice call, or chat via the app's 🎙 button). Mini Lorne logs it from the shell; the app only displays it.

## Rules (goals.json `mealRules`)
👎 if ANY of: an inflammatory trigger is present (`inflammatoryTriggers`, default `["seed oils"]`), carbs > `maxCarbsPerMealG` (30), or it is meal # > `maxMealsPerDay` (2) that America/New_York day. Otherwise 👍.
Seed oils: canola, soybean, corn, sunflower, safflower, cottonseed, grapeseed, "vegetable oil"; most fast-food fryer foods (McDonald's fries etc.).

## Steps
1. `cd /workspace/lorne-todos && git pull -q` (also pulls in meals he logged in the app).
2. For each food, look up carbs on the web (USDA FoodData Central, the restaurant's nutrition page); use `estimate` as the source if there's no good page.
   Check whether it's cooked or fried in seed oil. If yes, add `--trigger "seed oils"`.
3. Run it (S = store, R = repo):
```
S=/cursor/stores/store-e1652482-ff9c-4703-a7f6-eb30bd94823c/todos; R=/workspace/lorne-todos
# new meal (--at defaults to now; a time without an offset means NY local time)
python3 /workspace/lorne-todos-app/scripts/log_meal.py $S/meals.json $R/meals.json --goals $R/goals.json \
  --description "Quarter Pounder, no bun, medium fries" --at 2026-10-17T13:00 \
  --item "beef patty|0|estimate" --item "medium fries|43|https://www.mcdonalds.com/us/en-us/product/medium-french-fries.html" \
  --trigger "seed oils"
# carb check only (nothing saved)
python3 /workspace/lorne-todos-app/scripts/log_meal.py $R/meals.json --goals $R/goals.json --carbs-only \
  --description "apple" --item "apple, medium|25|https://fdc.nal.usda.gov/"
# attach carbs/triggers to a meal that's already logged (id from meals.json); --item replaces the carb list, --trigger replaces the trigger list
python3 /workspace/lorne-todos-app/scripts/log_meal.py $S/meals.json $R/meals.json --goals $R/goals.json \
  --update-id <id> --item "bun|24|estimate" --item "patty|0|estimate"
```
   The script prints JSON `{id, at, carbsG, inflammatory, verdict, verdictReason, saved}`. Tell Lorne the carbs, 👍/👎 and the reason in one sentence.
4. Commit and push the data repo:
   `cd /workspace/lorne-todos && git add meals.json && git -c user.name="Mini Lorne" -c user.email="mini@lorne" commit -qm "Log meal (voice)" && git push -q`
   If the push is rejected, run `git pull --rebase` and push again.

Notes: the entry fields are carbsG, carbItems[{food,carbsG,source}], inflammatory[], verdict, verdictReason, loggedVia. Old manual entries have no carbs, and that's fine. The app's ✎ menu can set carbs by hand, which recomputes the verdict.
