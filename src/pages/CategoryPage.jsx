import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";

export default function CategoryPage() {
  const { categoryId } = useParams();

  // Helper to format categoryId (e.g., food-colombo -> Food Colombo)
  const formattedTitle = categoryId
    ? categoryId
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
    : "Category";

  return (
    <div className="max-w-[1440px] mx-auto px-6 md:px-8 py-8 md:py-16">
      <Helmet>
        <title>{formattedTitle} Student Discounts & Offers in Sri Lanka | Uni Deals</title>
        <meta name="description" content={`Find the best ${formattedTitle} student discounts and offers in Sri Lanka. Unlock exclusive deals with your .ac.lk email.`} />
      </Helmet>
      
      <div className="text-center space-y-4">
        <h1 className="font-headline font-extrabold text-3xl">{formattedTitle} Student Discounts</h1>
        <p className="text-on-surface-variant">
          Discover all the exclusive offers for {formattedTitle}.
        </p>
        <div className="pt-8">
          <Link to={`/categories`} className="text-primary font-bold hover:underline">
            View All Categories
          </Link>
        </div>
      </div>
    </div>
  );
}
