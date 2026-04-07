import { NextRequest, NextResponse } from "next/server";
import { readDb } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("session_id");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const filter = searchParams.get("filter") || "all"; // all | validated | pending | low

    if (!sessionId)
      return NextResponse.json({ error: "session_id is required" }, { status: 400 });

    const db = readDb();
    const session = db.sessions.find((s) => s.id === sessionId);
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    let pairs = db.qa_pairs
      .filter((q) => q.session_id === sessionId)
      .sort((a, b) => a.row_index - b.row_index);

    const allValidations = db.validations.filter((v) => v.session_id === sessionId);
    const validationMap = new Map(allValidations.map((v) => [v.qa_pair_id, v]));

    // Apply filter
    if (filter === "validated") {
      pairs = pairs.filter((p) => validationMap.has(p.id));
    } else if (filter === "pending") {
      pairs = pairs.filter((p) => !validationMap.has(p.id));
    } else if (filter === "low") {
      pairs = pairs.filter((p) => {
        const v = validationMap.get(p.id);
        return v && v.validation_score < 40;
      });
    }

    const total = pairs.length;
    const offset = (page - 1) * limit;
    const paginated = pairs.slice(offset, offset + limit);

    const enriched = paginated.map((p) => {
      const v = validationMap.get(p.id);
      return {
        ...p,
        validation_id: v?.id || null,
        validation_score: v?.validation_score ?? null,
        comments: v?.comments ?? null,
        validated_at: v?.validated_at ?? null,
      };
    });

    return NextResponse.json({
      pairs: enriched,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      progress: {
        validated: allValidations.length,
        total: db.qa_pairs.filter((q) => q.session_id === sessionId).length,
      },
      session,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch Q&A pairs" }, { status: 500 });
  }
}
