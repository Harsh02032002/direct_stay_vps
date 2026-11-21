import shutil
import os

src_dir = r"C:\Users\HP\.gemini\antigravity\brain\339296c6-4b23-45cd-918c-5cd73bf866bd\browser_sandbox\screenshots"
dest_dir = r"C:\Users\HP\.gemini\antigravity\brain\5a18b0d2-1f6b-4d82-8c83-4f5554dc9b3b\test_evidence"

os.makedirs(dest_dir, exist_ok=True)

file_map = {
    'step_79_shot_1_01_same_date_hourly_booking.png': '01_same_date_hourly_booking.png',
    'step_77_shot_1_02_multiple_custom_addons.png': '02_multiple_custom_addons.png',
    'step_88_shot_1_03_invoice_grant_heights_ui.png': '03_invoice_grant_heights_ui.png',
    'step_90_shot_1_04_property_setup_rooms.png': '04_property_setup_rooms.png',
    'step_90_shot_2_05_property_setup_rate_plans.png': '05_property_setup_rate_plans.png',
    'step_90_shot_3_06_property_setup_amenities.png': '06_property_setup_amenities.png',
    'step_90_shot_4_07_property_setup_packages.png': '07_property_setup_packages.png',
    'step_95_shot_1_08_config_tax_setup.png': '08_config_tax_setup.png',
    'step_95_shot_2_09_config_payment_mode.png': '09_config_payment_mode.png',
    'step_95_shot_3_10_config_whatsapp.png': '10_config_whatsapp.png',
    'step_95_shot_4_11_config_master_setup.png': '11_config_master_setup.png',
    'step_95_shot_5_12_admin_users.png': '12_admin_users.png',
    'step_95_shot_6_13_admin_user_roles.png': '13_admin_user_roles.png',
    'step_95_shot_7_14_admin_audit_logs.png': '14_admin_audit_logs.png',
    'step_95_shot_8_15_admin_profile_setup.png': '15_admin_profile_setup.png',
}

for src_name, dst_name in file_map.items():
    s = os.path.join(src_dir, src_name)
    d = os.path.join(dest_dir, dst_name)
    if os.path.exists(s):
        shutil.copy2(s, d)
        print(f"Copied: {src_name} -> {dst_name} ({os.path.getsize(d):,} bytes)")
    else:
        print(f"NOT FOUND: {s}")
