## Sample Geocoding Verification

This folder lets you verify the external geocoder without changing the main app dataset.

Run the pipeline against the sample input:

```bash
set GEOCODER_ENABLED=true
set GEOCODER_API_KEY=your_opencage_key
set GEOCODER_INPUT_PATH=pipeline/samples/unresolved_repos.json
set GEOCODER_OUTPUT_PATH=pipeline/samples/unresolved_geodata.json
python pipeline/generate_dataset.py
```

Expected result:

- `pipeline/samples/unresolved_geodata.json` is created
- summary shows `external_api > 0`
- records get resolved coordinates from OpenCage
