import { prisma } from "../lib/prisma.js";

type GetFeedParams = {
  region: string;
  limit: number;
  page: number;
};

// fetches one page of articles for a region, most recent first
export async function getFeed({ region, limit, page }: GetFeedParams) {
  const skip = (page - 1) * limit;

  const [articles, totalCount] = await Promise.all([
    prisma.article.findMany({
      where: { region },
      orderBy: { publishedAt: "desc" },
      take: limit,
      skip,
      include: { publisher: { select: { id: true, name: true } } },
    }),
    prisma.article.count({ where: { region } }),
  ]);

  return {
    articles,
    page,
    limit,
    totalPages: Math.ceil(totalCount / limit),
  };
}