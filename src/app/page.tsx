import StorefrontPage, { revalidate } from "@/components/StorefrontPage";

export { revalidate };

interface Props {
  searchParams: Promise<{ q?: string; cat?: string; account?: string }>;
}

export default function HomePage({ searchParams }: Props) {
  return <StorefrontPage searchParams={searchParams} basePath="/" />;
}
