import collect_real_data
try:
    collect_real_data.collect_instagram('패션', '패션', 5000, 10000000)
except Exception as e:
    import traceback
    traceback.print_exc()
