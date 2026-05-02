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

        if m == "NAME_KO":
            n = len(text)
            if n <= 1:
                return "*"
            if n == 2:
                return text[0] + "*"
            if n == 3:
                return text[0] + "*" + text[2]
            if n == 4:
                return text[0] + "**" + text[3]
            # 5글자 이상: 3번째부터 마지막에서 2번째까지 마스킹
            middle_len = max(n - 4, 1)
            return text[:2] + ("*" * middle_len) + text[-2:]

        if m == "NAME_EN":
            if len(text) <= 1:
                return "*"
            # 두 번째 글자부터 전부 마스킹
            return text[0] + ("*" * (len(text) - 1))

        if m == "ADDRESS":
            tokens = text.split(" ")
            if len(tokens) <= 3:
                return tokens[0] + " ***" if tokens else "***"
            return " ".join(tokens[:3]) + " ***"

        return text

    def apply_masking_by_rules(
        self,
        rows: list[dict[str, Any]],
        rules: list[Mapping[str, Any]],
        *,
        unmask: bool,
    ) -> list[dict[str, Any]]:
        if unmask or not rows or not rules:
            return rows
        col_type_map: dict[str, str] = {}
        for rule in rules:
            col = str(rule.get("column_name") or "").upper()
            typ = str(rule.get("transform_key") or "").upper()
            if col and typ:
                col_type_map[col] = typ
        if not col_type_map:
            return rows
        masked: list[dict[str, Any]] = []
        for row in rows:
            next_row = dict(row)
            for key, value in row.items():
                typ = col_type_map.get(str(key).upper())
                if typ:
                    next_row[key] = self._mask_value(value, typ)
            masked.append(next_row)
        return masked
