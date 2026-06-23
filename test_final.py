import collect_real_data, logging
logging.basicConfig(level=logging.INFO)
print("Cosme Test:")
res_cosme = collect_real_data.collect_cosme("메이크업", "뷰티", 100, 1000000)
print("Cosme Total:", len(res_cosme))

print("TikTok Test:")
res_tiktok = collect_real_data.collect_tiktok("메이크업", "뷰티", 100, 1000000)
print("TikTok Total:", len(res_tiktok))
