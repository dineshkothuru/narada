alter table outlets
  drop column if exists gemini_api_key,
  drop column if exists sarvam_api_key;
