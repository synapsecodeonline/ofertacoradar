// Seta-sorriso oficial da logo Amazon — path real do wordmark
// (viewBox recortada na regiao do simbolo). Usado nos cards do site
// e na imagem de feed/story (/api/card).
export const AMZ_SMILE_PATHS = [
  "m 374.00642,142.18404 c -34.99948,25.79739 -85.72909,39.56123 -129.40634,39.56123 -61.24255,0 -116.37656,-22.65135 -158.08757,-60.32496 -3.2771,-2.96252 -0.34083,-6.9999 3.59171,-4.69283 45.01431,26.19064 100.67269,41.94697 158.16623,41.94697 38.774689,0 81.4295,-8.02237 120.6499,-24.67006 5.92501,-2.51683 10.87999,3.88009 5.08607,8.17965",
  "m 388.55678,125.53635 c -4.45688,-5.71527 -29.57261,-2.70033 -40.84585,-1.36327 -3.43442,0.41947 -3.95874,-2.56925 -0.86517,-4.71905 20.00346,-14.07844 52.82696,-10.01483 56.65462,-5.2958 3.82764,4.74526 -0.99624,37.64741 -19.79373,53.35128 -2.88385,2.41195 -5.63662,1.12734 -4.35198,-2.07113 4.2209,-10.53917 13.68519,-34.16054 9.20211,-39.90203",
];

export const AMZ_SMILE_VIEWBOX = "75 90 380 100";

export function AmazonMark({
  className = "h-3.5 w-9",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox={AMZ_SMILE_VIEWBOX}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {AMZ_SMILE_PATHS.map((d) => (
        <path key={d.slice(0, 24)} d={d} fill="#ff9900" />
      ))}
    </svg>
  );
}
