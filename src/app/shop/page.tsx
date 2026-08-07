import StorefrontPage from "@/components/StorefrontPage";

export const revalidate = 5;

interface Props {
  searchParams: Promise<{ q?: string; cat?: string; account?: string }>;
}

export default function ShopPage({ searchParams }: Props) {
  return <StorefrontPage searchParams={searchParams} basePath="/shop" />;
}
