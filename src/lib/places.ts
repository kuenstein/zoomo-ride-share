import type { Place } from "./geo";

export type ServiceArea = { id?: string; name: string; center_lat: number; center_lng: number; radius_km: number; active?: boolean };

export const POPULAR_PLACES: (Place & { name: string })[] = [
  { name: "Silliman University", lat: 9.3113, lng: 123.3083, address: "Silliman University, Hibbard Ave, Dumaguete City" },
  { name: "Rizal Boulevard", lat: 9.3093, lng: 123.3095, address: "Rizal Boulevard, Dumaguete City" },
  { name: "Dumaguete Public Market", lat: 9.3057, lng: 123.3035, address: "Dumaguete Public Market, Real St, Dumaguete City" },
  { name: "Robinsons Place Dumaguete", lat: 9.2935, lng: 123.3018, address: "Robinsons Place, Calindagan, Dumaguete City" },
  { name: "Dumaguete-Sibulan Airport", lat: 9.3337, lng: 123.3002, address: "Dumaguete-Sibulan Airport, Sibulan" },
  { name: "Dumaguete Port", lat: 9.3037, lng: 123.3108, address: "Dumaguete Port, Dumaguete City" },
  { name: "Bantayan Bell Tower", lat: 9.3066, lng: 123.3070, address: "Belfry / Bell Tower, Dumaguete City" },
  { name: "Pablo Rocamora Sports Complex", lat: 9.3142, lng: 123.2995, address: "Dr. Pablo Rocamora Sports Complex, Dumaguete City" },
  { name: "Lamberto Macias Hospital", lat: 9.3169, lng: 123.2977, address: "Lamberto Macias Memorial Hospital, Dumaguete City" },
  { name: "Negros Oriental Provincial Hospital", lat: 9.3094, lng: 123.3006, address: "Negros Oriental Provincial Hospital, Dumaguete City" },
  { name: "Bacong Church", lat: 9.2466, lng: 123.2944, address: "St. Augustine Church, Bacong" },
  { name: "Sibulan Public Market", lat: 9.3547, lng: 123.2856, address: "Sibulan Public Market, Sibulan" },
  { name: "Valencia town center", lat: 9.2826, lng: 123.2447, address: "Valencia Plaza, Valencia, Negros Oriental" },
  { name: "Casaroro Falls", lat: 9.2808, lng: 123.2131, address: "Casaroro Falls, Valencia, Negros Oriental" },
  { name: "Twin Lakes area", lat: 9.3355, lng: 123.2160, address: "Twin Lakes (Balinsasayao), Sibulan" },
];
