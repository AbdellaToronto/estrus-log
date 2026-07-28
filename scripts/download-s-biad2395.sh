#!/usr/bin/env bash
set -euo pipefail

base_url="https://ftp.ebi.ac.uk/biostudies/fire/S-BIAD/395/S-BIAD2395/Files"
destination="${1:-work/model-eval/public/S-BIAD2395}"
file_list="${destination}/filelist.tsv"

mkdir -p "${destination}"
curl -fsSL --retry 3 "${base_url}/filelist.tsv" -o "${file_list}"

tail -n +2 "${file_list}" | while IFS=$'\t' read -r relative_path expected_size; do
  encoded_path=$(printf '%s' "${relative_path}" | sed 's/ /%20/g; s/(/%28/g; s/)/%29/g')
  output_path="${destination}/${relative_path}"
  mkdir -p "$(dirname "${output_path}")"
  if [[ -f "${output_path}" ]] && [[ "$(wc -c < "${output_path}" | tr -d ' ')" == "${expected_size}" ]]; then
    continue
  fi
  curl -fsSL --retry 3 "${base_url}/${encoded_path}" -o "${output_path}"
done

echo "Downloaded S-BIAD2395 to ${destination}"
