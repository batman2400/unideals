import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";

export default function BrandPage() {
  const { brandId } = useParams();

  const formattedBrand = brandId
    ? brandId
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
    : "Brand";

  return (
    <div className="max-w-[1440px] mx-auto px-6 md:px-8 py-8 md:py-16">
      <Helmet>
        <title>{formattedBrand} Student Discount in Sri Lanka | Uni Deals</title>
        <meta name="description" content={`Get exclusive ${formattedBrand} student discounts and promo codes in Sri Lanka with your verified university email.`} />
      </Helmet>
      
      <div className="text-center space-y-4">
        <h1 className="font-headline font-extrabold text-3xl">{formattedBrand} Student Offers</h1>
        <p className="text-on-surface-variant">
          Save more at {formattedBrand} with your Uni Deals student pass.
        </p>
        <div className="pt-8">
          <Link to="/brands" className="text-primary font-bold hover:underline">
            View All Partner Brands
          </Link>
        </div>
      </div>
    </div>
  );
}
