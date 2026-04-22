from __future__ import annotations

import re
from collections.abc import Mapping
from typing import Any


class MaskingService:
    """
    Applies dynamic masking to result rows before API response/export.
    """

    def apply_masking(
        self,
        rows: list[dict[str, Any]],
        pii_metadata_rows: list[Mapping[str, Any]],
        *,
        unmask: bool,
    ) -> list[dict[str, Any]]:
        if unmask or not rows:
            return rows

        col_type_map: dict[str, str] = {}
        for row in pii_metadata_rows:
            col_name = str(row.get("COLUMN_NAME") or row.get("TARGET_COLUMN") or "").upper()
            mask_type = str(row.get("MASKING_TYPE") or row.get("PII_TYPE") or "CUSTOM").upper()
            if col_name:
                col_type_map[col_name] = mask_type

        if not col_type_map:
            return rows

        masked: list[dict[str, Any]] = []
        for row in rows:
            next_row = dict(row)
            for key, value in row.items():
                mask_type = col_type_map.get(str(key).upper())
                if not mask_type:
                    continue
                next_row[key] = self._mask_value(value, mask_type)
            masked.append(next_row)
        return masked

    def _mask_value(self, value: Any, mask_type: str) -> Any:
        if value is None:
            return None
        text = str(value)
        m = mask_type.upper()

        if m == "RRN":
            digits = re.sub(r"[^0-9]", "", text)
            if len(digits) >= 7:
                return f"{digits[:6]}-{digits[6]}******"
            return text[:8] + "******"

        if m == "PHONE":
            digits = re.sub(r"[^0-9]", "", text)
            if len(digits) >= 11:
                return f"{digits[:3]}-****-{digits[-4:]}"
            if len(digits) >= 8:
                return f"{digits[:3]}-****-{digits[-4:]}"
            return "***"

        if m == "NAME":
            if len(text) >= 3:
                return f"{text[0]}{'*' * (len(text) - 2)}{text[-1]}"
            if len(text) == 2:
                return f"{text[0]}*"
            return "*"

        return text
