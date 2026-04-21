"use client";

import { useMemo, useState } from "react";
import Prism from "prismjs";
import "prismjs/components/prism-sql";
import "prismjs/themes/prism-tomorrow.css";
import { Button } from "@/components/ui/button";

type Props = {
  sql: string;
};

export function QueryPreviewModal({ sql }: Props) {
  const [open, setOpen] = useState(false);
  const highlighted = useMemo(() => Prism.highlight(sql, Prism.languages.sql, "sql"), [sql]);

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        SQL 보기
      </Button>
      {open ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-3xl rounded-lg bg-white p-4 shadow-lg">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Query Preview</h3>
              <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
                닫기
              </Button>
            </div>
            <pre className="max-h-[60vh] overflow-auto rounded-md bg-neutral-900 p-4 text-xs text-neutral-100">
              <code dangerouslySetInnerHTML={{ __html: highlighted }} />
            </pre>
          </div>
        </div>
      ) : null}
    </>
  );
}
