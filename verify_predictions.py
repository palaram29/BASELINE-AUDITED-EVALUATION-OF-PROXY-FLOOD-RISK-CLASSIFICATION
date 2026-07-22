from database.db_connection import get_engine
import pandas as pd

engine = get_engine()
query = '''
SELECT "City", "Date", COUNT(*) AS cnt
FROM prediction_results
GROUP BY "City", "Date"
ORDER BY "Date" DESC, "City";
'''
df = pd.read_sql(query, engine)
print(df[df['cnt'] > 1].head(20).to_string(index=False))
print('\nduplicate groups:', int((df['cnt'] > 1).sum()))
latest = pd.read_sql('''
SELECT *
FROM prediction_results
WHERE "Date" = (SELECT MAX("Date") FROM prediction_results)
ORDER BY "City";
''', engine)
print('\nlatest rows:', len(latest))
print(latest.head(10).to_string(index=False))
