import StorefrontPage from "@/components/StorefrontPage";

export const revalidate = 60;

interface Props {
  searchParams: Promise<{ q?: string; cat?: string; account?: string }>;
}

export default function HomePage({ searchParams }: Props) {
  return <StorefrontPage searchParams={searchParams} basePath="/" />;
}
