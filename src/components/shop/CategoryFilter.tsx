"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { Category } from "@/types";

interface Props {
  categories: Category[];
  active: string;
}

export default function CategoryFilter({ categories, active }: Props) {
  const router = useRouter();
  const params = useSearchParams();

  function setCategory(cat: string) {
    const next = new URLSearchParams(params.toString());
    if (cat === "all") {
      next.delete("cat");
    } else {
      next.set("cat", cat);
    }
    next.delete("page"); // reset pagination on filter change
    router.push(`/shop?${next.toString()}`);
  }

  return (
    <div className="d-flex flex-wrap gap-2 mb-4">
      <button
        className={`btn btn-sm ${active === "all" ? "btn-dark" : "btn-outline-dark"}`}
        onClick={() => setCategory("all")}
        style={{ fontSize: "0.8rem" }}
      >
        All Products
      </button>

      {categories.map((c) => (
        <button
          key={c.id}
          className="btn btn-sm"
          onClick={() => setCategory(c.name)}
          style={{
            fontSize: "0.8rem",
            background: active === c.name ? c.color : "transparent",
            color: active === c.name ? "#fff" : c.color,
            borderColor: c.color,
          }}
        >
          {c.name}
        </button>
      ))}
    </div>
  );
}
