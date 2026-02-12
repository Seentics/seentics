// Comprehensive country data for all 194 UN member states + territories
// This file contains country names, ISO codes, coordinates, and geography mappings

export interface CountryInfo {
  name: string;
  code: string;
  coordinates: [number, number]; // [longitude, latitude]
  continent: string;
  region: string;
}

// All 194 UN member countries + major territories
export const COUNTRIES: Record<string, CountryInfo> = {
  // North America
  'United States': { name: 'United States', code: 'US', coordinates: [-95.7129, 37.0902], continent: 'North America', region: 'Northern America' },
  'Canada': { name: 'Canada', code: 'CA', coordinates: [-106.3468, 56.1304], continent: 'North America', region: 'Northern America' },
  'Mexico': { name: 'Mexico', code: 'MX', coordinates: [-102.5528, 23.6345], continent: 'North America', region: 'Central America' },
  'Guatemala': { name: 'Guatemala', code: 'GT', coordinates: [-90.2308, 15.7835], continent: 'North America', region: 'Central America' },
  'Belize': { name: 'Belize', code: 'BZ', coordinates: [-88.4976, 17.1899], continent: 'North America', region: 'Central America' },
  'El Salvador': { name: 'El Salvador', code: 'SV', coordinates: [-88.8965, 13.7942], continent: 'North America', region: 'Central America' },
  'Honduras': { name: 'Honduras', code: 'HN', coordinates: [-87.2750, 15.2000], continent: 'North America', region: 'Central America' },
  'Nicaragua': { name: 'Nicaragua', code: 'NI', coordinates: [-85.2072, 12.8654], continent: 'North America', region: 'Central America' },
  'Costa Rica': { name: 'Costa Rica', code: 'CR', coordinates: [-83.7534, 9.7489], continent: 'North America', region: 'Central America' },
  'Panama': { name: 'Panama', code: 'PA', coordinates: [-80.7821, 8.5380], continent: 'North America', region: 'Central America' },
  'Cuba': { name: 'Cuba', code: 'CU', coordinates: [-77.7812, 21.5218], continent: 'North America', region: 'Caribbean' },
  'Jamaica': { name: 'Jamaica', code: 'JM', coordinates: [-77.2975, 18.1096], continent: 'North America', region: 'Caribbean' },
  'Haiti': { name: 'Haiti', code: 'HT', coordinates: [-72.2852, 18.9712], continent: 'North America', region: 'Caribbean' },
  'Dominican Republic': { name: 'Dominican Republic', code: 'DO', coordinates: [-70.1627, 18.7357], continent: 'North America', region: 'Caribbean' },
  'Bahamas': { name: 'Bahamas', code: 'BS', coordinates: [-77.3963, 25.0343], continent: 'North America', region: 'Caribbean' },
  'Barbados': { name: 'Barbados', code: 'BB', coordinates: [-59.5432, 13.1939], continent: 'North America', region: 'Caribbean' },
  'Trinidad and Tobago': { name: 'Trinidad and Tobago', code: 'TT', coordinates: [-61.2225, 10.6918], continent: 'North America', region: 'Caribbean' },
  'Saint Kitts and Nevis': { name: 'Saint Kitts and Nevis', code: 'KN', coordinates: [-62.7830, 17.3578], continent: 'North America', region: 'Caribbean' },
  'Saint Lucia': { name: 'Saint Lucia', code: 'LC', coordinates: [-60.9789, 13.9094], continent: 'North America', region: 'Caribbean' },
  'Saint Vincent and the Grenadines': { name: 'Saint Vincent and the Grenadines', code: 'VC', coordinates: [-61.2872, 12.9843], continent: 'North America', region: 'Caribbean' },
  'Grenada': { name: 'Grenada', code: 'GD', coordinates: [-61.6790, 12.1165], continent: 'North America', region: 'Caribbean' },
  'Antigua and Barbuda': { name: 'Antigua and Barbuda', code: 'AG', coordinates: [-61.7965, 17.0608], continent: 'North America', region: 'Caribbean' },
  'Dominica': { name: 'Dominica', code: 'DM', coordinates: [-61.3710, 15.4150], continent: 'North America', region: 'Caribbean' },

  // South America
  'Brazil': { name: 'Brazil', code: 'BR', coordinates: [-51.9253, -14.2350], continent: 'South America', region: 'South America' },
  'Argentina': { name: 'Argentina', code: 'AR', coordinates: [-63.6167, -38.4161], continent: 'South America', region: 'South America' },
  'Chile': { name: 'Chile', code: 'CL', coordinates: [-71.5430, -35.6751], continent: 'South America', region: 'South America' },
  'Colombia': { name: 'Colombia', code: 'CO', coordinates: [-74.2973, 4.5709], continent: 'South America', region: 'South America' },
  'Peru': { name: 'Peru', code: 'PE', coordinates: [-75.0152, -9.1900], continent: 'South America', region: 'South America' },
  'Venezuela': { name: 'Venezuela', code: 'VE', coordinates: [-66.5897, 6.4238], continent: 'South America', region: 'South America' },
  'Ecuador': { name: 'Ecuador', code: 'EC', coordinates: [-78.1834, -1.8312], continent: 'South America', region: 'South America' },
  'Bolivia': { name: 'Bolivia', code: 'BO', coordinates: [-63.5887, -16.2902], continent: 'South America', region: 'South America' },
  'Paraguay': { name: 'Paraguay', code: 'PY', coordinates: [-58.4438, -23.4425], continent: 'South America', region: 'South America' },
  'Uruguay': { name: 'Uruguay', code: 'UY', coordinates: [-55.7658, -32.5228], continent: 'South America', region: 'South America' },
  'Guyana': { name: 'Guyana', code: 'GY', coordinates: [-58.9302, 4.8604], continent: 'South America', region: 'South America' },
  'Suriname': { name: 'Suriname', code: 'SR', coordinates: [-56.0278, 3.9193], continent: 'South America', region: 'South America' },

  // Europe - Western
  'United Kingdom': { name: 'United Kingdom', code: 'GB', coordinates: [-3.4360, 55.3781], continent: 'Europe', region: 'Western Europe' },
  'Germany': { name: 'Germany', code: 'DE', coordinates: [10.4515, 51.1657], continent: 'Europe', region: 'Western Europe' },
  'France': { name: 'France', code: 'FR', coordinates: [2.2137, 46.2276], continent: 'Europe', region: 'Western Europe' },
  'Netherlands': { name: 'Netherlands', code: 'NL', coordinates: [5.2913, 52.1326], continent: 'Europe', region: 'Western Europe' },
  'Belgium': { name: 'Belgium', code: 'BE', coordinates: [4.4699, 50.5039], continent: 'Europe', region: 'Western Europe' },
  'Switzerland': { name: 'Switzerland', code: 'CH', coordinates: [8.2275, 46.8182], continent: 'Europe', region: 'Western Europe' },
  'Austria': { name: 'Austria', code: 'AT', coordinates: [14.5501, 47.5162], continent: 'Europe', region: 'Western Europe' },
  'Ireland': { name: 'Ireland', code: 'IE', coordinates: [-8.2439, 53.4129], continent: 'Europe', region: 'Western Europe' },
  'Luxembourg': { name: 'Luxembourg', code: 'LU', coordinates: [6.1296, 49.8153], continent: 'Europe', region: 'Western Europe' },
  'Monaco': { name: 'Monaco', code: 'MC', coordinates: [7.4167, 43.7333], continent: 'Europe', region: 'Western Europe' },
  'Liechtenstein': { name: 'Liechtenstein', code: 'LI', coordinates: [9.5554, 47.1660], continent: 'Europe', region: 'Western Europe' },
  'Andorra': { name: 'Andorra', code: 'AD', coordinates: [1.6016, 42.5063], continent: 'Europe', region: 'Western Europe' },

  // Europe - Northern
  'Sweden': { name: 'Sweden', code: 'SE', coordinates: [18.6435, 60.1282], continent: 'Europe', region: 'Northern Europe' },
  'Norway': { name: 'Norway', code: 'NO', coordinates: [8.4689, 60.4720], continent: 'Europe', region: 'Northern Europe' },
  'Denmark': { name: 'Denmark', code: 'DK', coordinates: [9.5018, 56.2639], continent: 'Europe', region: 'Northern Europe' },
  'Finland': { name: 'Finland', code: 'FI', coordinates: [25.7482, 61.9241], continent: 'Europe', region: 'Northern Europe' },
  'Iceland': { name: 'Iceland', code: 'IS', coordinates: [-19.0208, 64.9631], continent: 'Europe', region: 'Northern Europe' },

  // Europe - Southern
  'Spain': { name: 'Spain', code: 'ES', coordinates: [-3.7492, 40.4637], continent: 'Europe', region: 'Southern Europe' },
  'Italy': { name: 'Italy', code: 'IT', coordinates: [12.5674, 41.8719], continent: 'Europe', region: 'Southern Europe' },
  'Portugal': { name: 'Portugal', code: 'PT', coordinates: [-8.2245, 39.3999], continent: 'Europe', region: 'Southern Europe' },
  'Greece': { name: 'Greece', code: 'GR', coordinates: [21.8243, 39.0742], continent: 'Europe', region: 'Southern Europe' },
  'Malta': { name: 'Malta', code: 'MT', coordinates: [14.3754, 35.9375], continent: 'Europe', region: 'Southern Europe' },
  'Cyprus': { name: 'Cyprus', code: 'CY', coordinates: [33.4299, 35.1264], continent: 'Europe', region: 'Southern Europe' },
  'San Marino': { name: 'San Marino', code: 'SM', coordinates: [12.4578, 43.9424], continent: 'Europe', region: 'Southern Europe' },
  'Vatican City': { name: 'Vatican City', code: 'VA', coordinates: [12.4534, 41.9029], continent: 'Europe', region: 'Southern Europe' },

  // Europe - Eastern
  'Poland': { name: 'Poland', code: 'PL', coordinates: [19.1343, 51.9194], continent: 'Europe', region: 'Eastern Europe' },
  'Czech Republic': { name: 'Czech Republic', code: 'CZ', coordinates: [15.4730, 49.8175], continent: 'Europe', region: 'Eastern Europe' },
  'Slovakia': { name: 'Slovakia', code: 'SK', coordinates: [19.6990, 48.6690], continent: 'Europe', region: 'Eastern Europe' },
  'Hungary': { name: 'Hungary', code: 'HU', coordinates: [19.5033, 47.1625], continent: 'Europe', region: 'Eastern Europe' },
  'Romania': { name: 'Romania', code: 'RO', coordinates: [24.9668, 45.9432], continent: 'Europe', region: 'Eastern Europe' },
  'Bulgaria': { name: 'Bulgaria', code: 'BG', coordinates: [25.4858, 42.7339], continent: 'Europe', region: 'Eastern Europe' },
  'Croatia': { name: 'Croatia', code: 'HR', coordinates: [15.2000, 45.1000], continent: 'Europe', region: 'Eastern Europe' },
  'Slovenia': { name: 'Slovenia', code: 'SI', coordinates: [14.9955, 46.1512], continent: 'Europe', region: 'Eastern Europe' },
  'Serbia': { name: 'Serbia', code: 'RS', coordinates: [21.0059, 44.0165], continent: 'Europe', region: 'Eastern Europe' },
  'Bosnia and Herzegovina': { name: 'Bosnia and Herzegovina', code: 'BA', coordinates: [17.6791, 43.9159], continent: 'Europe', region: 'Eastern Europe' },
  'Montenegro': { name: 'Montenegro', code: 'ME', coordinates: [19.3744, 42.7087], continent: 'Europe', region: 'Eastern Europe' },
  'North Macedonia': { name: 'North Macedonia', code: 'MK', coordinates: [21.7453, 41.6086], continent: 'Europe', region: 'Eastern Europe' },
  'Albania': { name: 'Albania', code: 'AL', coordinates: [20.1683, 41.1533], continent: 'Europe', region: 'Eastern Europe' },
  'Lithuania': { name: 'Lithuania', code: 'LT', coordinates: [23.8813, 55.1694], continent: 'Europe', region: 'Eastern Europe' },
  'Latvia': { name: 'Latvia', code: 'LV', coordinates: [24.6032, 56.8796], continent: 'Europe', region: 'Eastern Europe' },
  'Estonia': { name: 'Estonia', code: 'EE', coordinates: [25.0136, 58.5953], continent: 'Europe', region: 'Eastern Europe' },
  'Belarus': { name: 'Belarus', code: 'BY', coordinates: [27.9534, 53.7098], continent: 'Europe', region: 'Eastern Europe' },
  'Ukraine': { name: 'Ukraine', code: 'UA', coordinates: [31.1656, 48.3794], continent: 'Europe', region: 'Eastern Europe' },
  'Moldova': { name: 'Moldova', code: 'MD', coordinates: [28.3699, 47.4116], continent: 'Europe', region: 'Eastern Europe' },
  'Russia': { name: 'Russia', code: 'RU', coordinates: [105.3188, 61.5240], continent: 'Europe', region: 'Eastern Europe' },

  // Asia - Eastern
  'China': { name: 'China', code: 'CN', coordinates: [104.1954, 35.8617], continent: 'Asia', region: 'Eastern Asia' },
  'Japan': { name: 'Japan', code: 'JP', coordinates: [138.2529, 36.2048], continent: 'Asia', region: 'Eastern Asia' },
  'South Korea': { name: 'South Korea', code: 'KR', coordinates: [127.7669, 35.9078], continent: 'Asia', region: 'Eastern Asia' },
  'North Korea': { name: 'North Korea', code: 'KP', coordinates: [127.5101, 40.3399], continent: 'Asia', region: 'Eastern Asia' },
  'Mongolia': { name: 'Mongolia', code: 'MN', coordinates: [103.8467, 46.8625], continent: 'Asia', region: 'Eastern Asia' },
  'Taiwan': { name: 'Taiwan', code: 'TW', coordinates: [120.9605, 23.6978], continent: 'Asia', region: 'Eastern Asia' },

  // Asia - Southeastern
  'Indonesia': { name: 'Indonesia', code: 'ID', coordinates: [113.9213, -0.7893], continent: 'Asia', region: 'Southeast Asia' },
  'Thailand': { name: 'Thailand', code: 'TH', coordinates: [100.9925, 15.8700], continent: 'Asia', region: 'Southeast Asia' },
  'Vietnam': { name: 'Vietnam', code: 'VN', coordinates: [108.2772, 14.0583], continent: 'Asia', region: 'Southeast Asia' },
  'Philippines': { name: 'Philippines', code: 'PH', coordinates: [121.7740, 12.8797], continent: 'Asia', region: 'Southeast Asia' },
  'Myanmar': { name: 'Myanmar', code: 'MM', coordinates: [95.9560, 21.9162], continent: 'Asia', region: 'Southeast Asia' },
  'Malaysia': { name: 'Malaysia', code: 'MY', coordinates: [101.9758, 4.2105], continent: 'Asia', region: 'Southeast Asia' },
  'Singapore': { name: 'Singapore', code: 'SG', coordinates: [103.8198, 1.3521], continent: 'Asia', region: 'Southeast Asia' },
  'Cambodia': { name: 'Cambodia', code: 'KH', coordinates: [104.9910, 12.5657], continent: 'Asia', region: 'Southeast Asia' },
  'Laos': { name: 'Laos', code: 'LA', coordinates: [102.4955, 19.8563], continent: 'Asia', region: 'Southeast Asia' },
  'Brunei': { name: 'Brunei', code: 'BN', coordinates: [114.7277, 4.5353], continent: 'Asia', region: 'Southeast Asia' },
  'Timor-Leste': { name: 'Timor-Leste', code: 'TL', coordinates: [125.7275, -8.8742], continent: 'Asia', region: 'Southeast Asia' },

  // Asia - Southern
  'India': { name: 'India', code: 'IN', coordinates: [78.9629, 20.5937], continent: 'Asia', region: 'Southern Asia' },
  'Pakistan': { name: 'Pakistan', code: 'PK', coordinates: [69.3451, 30.3753], continent: 'Asia', region: 'Southern Asia' },
  'Bangladesh': { name: 'Bangladesh', code: 'BD', coordinates: [90.3563, 23.6850], continent: 'Asia', region: 'Southern Asia' },
  'Afghanistan': { name: 'Afghanistan', code: 'AF', coordinates: [67.7100, 33.9391], continent: 'Asia', region: 'Southern Asia' },
  'Sri Lanka': { name: 'Sri Lanka', code: 'LK', coordinates: [80.7718, 7.8731], continent: 'Asia', region: 'Southern Asia' },
  'Nepal': { name: 'Nepal', code: 'NP', coordinates: [84.1240, 28.3949], continent: 'Asia', region: 'Southern Asia' },
  'Bhutan': { name: 'Bhutan', code: 'BT', coordinates: [90.4336, 27.5142], continent: 'Asia', region: 'Southern Asia' },
  'Maldives': { name: 'Maldives', code: 'MV', coordinates: [73.2207, 3.2028], continent: 'Asia', region: 'Southern Asia' },

  // Asia - Central
  'Kazakhstan': { name: 'Kazakhstan', code: 'KZ', coordinates: [66.9237, 48.0196], continent: 'Asia', region: 'Central Asia' },
  'Uzbekistan': { name: 'Uzbekistan', code: 'UZ', coordinates: [64.5853, 41.3775], continent: 'Asia', region: 'Central Asia' },
  'Turkmenistan': { name: 'Turkmenistan', code: 'TM', coordinates: [59.5563, 38.9697], continent: 'Asia', region: 'Central Asia' },
  'Kyrgyzstan': { name: 'Kyrgyzstan', code: 'KG', coordinates: [74.7661, 41.2044], continent: 'Asia', region: 'Central Asia' },
  'Tajikistan': { name: 'Tajikistan', code: 'TJ', coordinates: [71.2761, 38.8610], continent: 'Asia', region: 'Central Asia' },

  // Middle East
  'Saudi Arabia': { name: 'Saudi Arabia', code: 'SA', coordinates: [45.0792, 23.8859], continent: 'Asia', region: 'Western Asia' },
  'Iran': { name: 'Iran', code: 'IR', coordinates: [53.6880, 32.4279], continent: 'Asia', region: 'Western Asia' },
  'Iraq': { name: 'Iraq', code: 'IQ', coordinates: [43.6793, 33.2232], continent: 'Asia', region: 'Western Asia' },
  'United Arab Emirates': { name: 'United Arab Emirates', code: 'AE', coordinates: [53.8478, 23.4241], continent: 'Asia', region: 'Western Asia' },
  'Israel': { name: 'Israel', code: 'IL', coordinates: [34.8516, 31.0461], continent: 'Asia', region: 'Western Asia' },
  'Jordan': { name: 'Jordan', code: 'JO', coordinates: [36.2384, 30.5852], continent: 'Asia', region: 'Western Asia' },
  'Lebanon': { name: 'Lebanon', code: 'LB', coordinates: [35.8623, 33.8547], continent: 'Asia', region: 'Western Asia' },
  'Syria': { name: 'Syria', code: 'SY', coordinates: [38.9968, 34.8021], continent: 'Asia', region: 'Western Asia' },
  'Yemen': { name: 'Yemen', code: 'YE', coordinates: [48.5164, 15.5527], continent: 'Asia', region: 'Western Asia' },
  'Oman': { name: 'Oman', code: 'OM', coordinates: [55.9233, 21.4735], continent: 'Asia', region: 'Western Asia' },
  'Kuwait': { name: 'Kuwait', code: 'KW', coordinates: [47.4818, 29.3117], continent: 'Asia', region: 'Western Asia' },
  'Qatar': { name: 'Qatar', code: 'QA', coordinates: [51.1839, 25.3548], continent: 'Asia', region: 'Western Asia' },
  'Bahrain': { name: 'Bahrain', code: 'BH', coordinates: [50.5577, 26.0667], continent: 'Asia', region: 'Western Asia' },
  'Turkey': { name: 'Turkey', code: 'TR', coordinates: [35.2433, 38.9637], continent: 'Asia', region: 'Western Asia' },
  'Armenia': { name: 'Armenia', code: 'AM', coordinates: [45.0382, 40.0691], continent: 'Asia', region: 'Western Asia' },
  'Azerbaijan': { name: 'Azerbaijan', code: 'AZ', coordinates: [47.5769, 40.1431], continent: 'Asia', region: 'Western Asia' },
  'Georgia': { name: 'Georgia', code: 'GE', coordinates: [43.3569, 42.3154], continent: 'Asia', region: 'Western Asia' },
  'Palestine': { name: 'Palestine', code: 'PS', coordinates: [35.2332, 31.9522], continent: 'Asia', region: 'Western Asia' },

  // Africa - Northern
  'Egypt': { name: 'Egypt', code: 'EG', coordinates: [30.8025, 26.8206], continent: 'Africa', region: 'Northern Africa' },
  'Libya': { name: 'Libya', code: 'LY', coordinates: [17.2283, 26.3351], continent: 'Africa', region: 'Northern Africa' },
  'Tunisia': { name: 'Tunisia', code: 'TN', coordinates: [9.5375, 33.8869], continent: 'Africa', region: 'Northern Africa' },
  'Algeria': { name: 'Algeria', code: 'DZ', coordinates: [1.6596, 28.0339], continent: 'Africa', region: 'Northern Africa' },
  'Morocco': { name: 'Morocco', code: 'MA', coordinates: [-7.0926, 31.7917], continent: 'Africa', region: 'Northern Africa' },
  'Sudan': { name: 'Sudan', code: 'SD', coordinates: [30.2176, 12.8628], continent: 'Africa', region: 'Northern Africa' },

  // Africa - Western
  'Nigeria': { name: 'Nigeria', code: 'NG', coordinates: [8.6753, 9.0820], continent: 'Africa', region: 'Western Africa' },
  'Ghana': { name: 'Ghana', code: 'GH', coordinates: [-1.0232, 7.9465], continent: 'Africa', region: 'Western Africa' },
  'Ivory Coast': { name: 'Ivory Coast', code: 'CI', coordinates: [-5.5471, 7.5400], continent: 'Africa', region: 'Western Africa' },
  'Senegal': { name: 'Senegal', code: 'SN', coordinates: [-14.4524, 14.4974], continent: 'Africa', region: 'Western Africa' },
  'Mali': { name: 'Mali', code: 'ML', coordinates: [-3.9962, 17.5707], continent: 'Africa', region: 'Western Africa' },
  'Burkina Faso': { name: 'Burkina Faso', code: 'BF', coordinates: [-1.5616, 12.2383], continent: 'Africa', region: 'Western Africa' },
  'Niger': { name: 'Niger', code: 'NE', coordinates: [8.0817, 17.6078], continent: 'Africa', region: 'Western Africa' },
  'Guinea': { name: 'Guinea', code: 'GN', coordinates: [-9.6966, 9.9456], continent: 'Africa', region: 'Western Africa' },
  'Benin': { name: 'Benin', code: 'BJ', coordinates: [2.3158, 9.3077], continent: 'Africa', region: 'Western Africa' },
  'Togo': { name: 'Togo', code: 'TG', coordinates: [0.8248, 8.6195], continent: 'Africa', region: 'Western Africa' },
  'Sierra Leone': { name: 'Sierra Leone', code: 'SL', coordinates: [-11.7799, 8.4606], continent: 'Africa', region: 'Western Africa' },
  'Liberia': { name: 'Liberia', code: 'LR', coordinates: [-9.4295, 6.4281], continent: 'Africa', region: 'Western Africa' },
  'Mauritania': { name: 'Mauritania', code: 'MR', coordinates: [-10.9408, 21.0079], continent: 'Africa', region: 'Western Africa' },
  'Gambia': { name: 'Gambia', code: 'GM', coordinates: [-15.3101, 13.4432], continent: 'Africa', region: 'Western Africa' },
  'Guinea-Bissau': { name: 'Guinea-Bissau', code: 'GW', coordinates: [-15.1804, 11.8037], continent: 'Africa', region: 'Western Africa' },
  'Cape Verde': { name: 'Cape Verde', code: 'CV', coordinates: [-24.0131, 16.5388], continent: 'Africa', region: 'Western Africa' },

  // Africa - Eastern
  'Ethiopia': { name: 'Ethiopia', code: 'ET', coordinates: [40.4897, 9.1450], continent: 'Africa', region: 'Eastern Africa' },
  'Kenya': { name: 'Kenya', code: 'KE', coordinates: [37.9062, -0.0236], continent: 'Africa', region: 'Eastern Africa' },
  'Tanzania': { name: 'Tanzania', code: 'TZ', coordinates: [34.8888, -6.3690], continent: 'Africa', region: 'Eastern Africa' },
  'Uganda': { name: 'Uganda', code: 'UG', coordinates: [32.2903, 1.3733], continent: 'Africa', region: 'Eastern Africa' },
  'Somalia': { name: 'Somalia', code: 'SO', coordinates: [46.1996, 5.1521], continent: 'Africa', region: 'Eastern Africa' },
  'Rwanda': { name: 'Rwanda', code: 'RW', coordinates: [29.8739, -1.9403], continent: 'Africa', region: 'Eastern Africa' },
  'Burundi': { name: 'Burundi', code: 'BI', coordinates: [29.9189, -3.3731], continent: 'Africa', region: 'Eastern Africa' },
  'Eritrea': { name: 'Eritrea', code: 'ER', coordinates: [39.7823, 15.1794], continent: 'Africa', region: 'Eastern Africa' },
  'Djibouti': { name: 'Djibouti', code: 'DJ', coordinates: [42.5903, 11.8251], continent: 'Africa', region: 'Eastern Africa' },
  'South Sudan': { name: 'South Sudan', code: 'SS', coordinates: [31.3070, 6.8770], continent: 'Africa', region: 'Eastern Africa' },
  'Madagascar': { name: 'Madagascar', code: 'MG', coordinates: [46.8691, -18.7669], continent: 'Africa', region: 'Eastern Africa' },
  'Mauritius': { name: 'Mauritius', code: 'MU', coordinates: [57.5522, -20.3484], continent: 'Africa', region: 'Eastern Africa' },
  'Seychelles': { name: 'Seychelles', code: 'SC', coordinates: [55.4920, -4.6796], continent: 'Africa', region: 'Eastern Africa' },
  'Comoros': { name: 'Comoros', code: 'KM', coordinates: [43.8711, -11.6455], continent: 'Africa', region: 'Eastern Africa' },

  // Africa - Central
  'Democratic Republic of the Congo': { name: 'Democratic Republic of the Congo', code: 'CD', coordinates: [21.7587, -4.0383], continent: 'Africa', region: 'Central Africa' },
  'Central African Republic': { name: 'Central African Republic', code: 'CF', coordinates: [20.9394, 6.6111], continent: 'Africa', region: 'Central Africa' },
  'Chad': { name: 'Chad', code: 'TD', coordinates: [18.7322, 15.4542], continent: 'Africa', region: 'Central Africa' },
  'Cameroon': { name: 'Cameroon', code: 'CM', coordinates: [12.3547, 7.3697], continent: 'Africa', region: 'Central Africa' },
  'Republic of the Congo': { name: 'Republic of the Congo', code: 'CG', coordinates: [15.8277, -0.2280], continent: 'Africa', region: 'Central Africa' },
  'Gabon': { name: 'Gabon', code: 'GA', coordinates: [11.6094, -0.8037], continent: 'Africa', region: 'Central Africa' },
  'Equatorial Guinea': { name: 'Equatorial Guinea', code: 'GQ', coordinates: [10.2679, 1.6508], continent: 'Africa', region: 'Central Africa' },
  'São Tomé and Príncipe': { name: 'São Tomé and Príncipe', code: 'ST', coordinates: [6.6131, 0.1864], continent: 'Africa', region: 'Central Africa' },

  // Africa - Southern
  'South Africa': { name: 'South Africa', code: 'ZA', coordinates: [22.9375, -30.5595], continent: 'Africa', region: 'Southern Africa' },
  'Zimbabwe': { name: 'Zimbabwe', code: 'ZW', coordinates: [29.1549, -19.0154], continent: 'Africa', region: 'Southern Africa' },
  'Botswana': { name: 'Botswana', code: 'BW', coordinates: [24.6849, -22.3285], continent: 'Africa', region: 'Southern Africa' },
  'Namibia': { name: 'Namibia', code: 'NA', coordinates: [18.4241, -22.9576], continent: 'Africa', region: 'Southern Africa' },
  'Zambia': { name: 'Zambia', code: 'ZM', coordinates: [27.8546, -13.1339], continent: 'Africa', region: 'Southern Africa' },
  'Malawi': { name: 'Malawi', code: 'MW', coordinates: [34.3015, -13.2543], continent: 'Africa', region: 'Southern Africa' },
  'Mozambique': { name: 'Mozambique', code: 'MZ', coordinates: [35.5296, -18.6657], continent: 'Africa', region: 'Southern Africa' },
  'Angola': { name: 'Angola', code: 'AO', coordinates: [17.8739, -11.2027], continent: 'Africa', region: 'Southern Africa' },
  'Lesotho': { name: 'Lesotho', code: 'LS', coordinates: [28.2336, -29.6100], continent: 'Africa', region: 'Southern Africa' },
  'Eswatini': { name: 'Eswatini', code: 'SZ', coordinates: [31.4659, -26.5225], continent: 'Africa', region: 'Southern Africa' },

  // Oceania
  'Australia': { name: 'Australia', code: 'AU', coordinates: [133.7751, -25.2744], continent: 'Oceania', region: 'Australia and New Zealand' },
  'New Zealand': { name: 'New Zealand', code: 'NZ', coordinates: [174.8860, -40.9006], continent: 'Oceania', region: 'Australia and New Zealand' },
  'Papua New Guinea': { name: 'Papua New Guinea', code: 'PG', coordinates: [143.9555, -6.3150], continent: 'Oceania', region: 'Melanesia' },
  'Fiji': { name: 'Fiji', code: 'FJ', coordinates: [179.4144, -16.5780], continent: 'Oceania', region: 'Melanesia' },
  'Solomon Islands': { name: 'Solomon Islands', code: 'SB', coordinates: [160.1562, -9.6457], continent: 'Oceania', region: 'Melanesia' },
  'Vanuatu': { name: 'Vanuatu', code: 'VU', coordinates: [166.9592, -15.3767], continent: 'Oceania', region: 'Melanesia' },
  'New Caledonia': { name: 'New Caledonia', code: 'NC', coordinates: [165.6189, -20.9043], continent: 'Oceania', region: 'Melanesia' },
  'Samoa': { name: 'Samoa', code: 'WS', coordinates: [-172.1046, -13.7590], continent: 'Oceania', region: 'Polynesia' },
  'Tonga': { name: 'Tonga', code: 'TO', coordinates: [-175.1982, -21.1789], continent: 'Oceania', region: 'Polynesia' },
  'Kiribati': { name: 'Kiribati', code: 'KI', coordinates: [-157.3630, 1.8709], continent: 'Oceania', region: 'Micronesia' },
  'Palau': { name: 'Palau', code: 'PW', coordinates: [134.5825, 7.5150], continent: 'Oceania', region: 'Micronesia' },
  'Marshall Islands': { name: 'Marshall Islands', code: 'MH', coordinates: [171.1845, 7.1315], continent: 'Oceania', region: 'Micronesia' },
  'Micronesia': { name: 'Micronesia', code: 'FM', coordinates: [150.5508, 7.4256], continent: 'Oceania', region: 'Micronesia' },
  'Nauru': { name: 'Nauru', code: 'NR', coordinates: [166.9315, -0.5228], continent: 'Oceania', region: 'Micronesia' },
  'Tuvalu': { name: 'Tuvalu', code: 'TV', coordinates: [177.6493, -7.1095], continent: 'Oceania', region: 'Polynesia' },
};

// Helper functions for country data
export const getCountryByName = (name: string): CountryInfo | undefined => {
  return COUNTRIES[name];
};

export const getCountryByCode = (code: string): CountryInfo | undefined => {
  return Object.values(COUNTRIES).find(country => country.code === code);
};

export const getCountriesByContinent = (continent: string): CountryInfo[] => {
  return Object.values(COUNTRIES).filter(country => country.continent === continent);
};

export const getCountriesByRegion = (region: string): CountryInfo[] => {
  return Object.values(COUNTRIES).filter(country => country.region === region);
};

// Get country coordinates
export const getCountryCoordinates = (name: string): [number, number] | undefined => {
  return COUNTRIES[name]?.coordinates;
};

// Get country ISO code
export const getCountryCode = (name: string): string | undefined => {
  return COUNTRIES[name]?.code;
};

// Get country flag URL
export const getCountryFlag = (name: string): string => {
  const country = COUNTRIES[name];
  if (!country) {
    return `https://flagcdn.com/w40/${name.substring(0, 2).toLowerCase()}.png`;
  }
  return `https://flagcdn.com/w40/${country.code.toLowerCase()}.png`;
};

// Geography name mapping for world atlas compatibility
export const GEOGRAPHY_NAME_MAPPING: Record<string, string> = {
  // North America
  'United States of America': 'United States',
  'USA': 'United States',
  'US': 'United States',
  'United Mexican States': 'Mexico',
  
  // Europe
  'UK': 'United Kingdom',
  'Great Britain': 'United Kingdom',
  'England': 'United Kingdom',
  'Scotland': 'United Kingdom',
  'Wales': 'United Kingdom',
  'Northern Ireland': 'United Kingdom',
  'Federal Republic of Germany': 'Germany',
  'French Republic': 'France',
  'Kingdom of the Netherlands': 'Netherlands',
  'Holland': 'Netherlands',
  'Kingdom of Spain': 'Spain',
  'Italian Republic': 'Italy',
  'Kingdom of Sweden': 'Sweden',
  'Kingdom of Norway': 'Norway',
  'Kingdom of Denmark': 'Denmark',
  'Republic of Finland': 'Finland',
  'Swiss Confederation': 'Switzerland',
  'Republic of Austria': 'Austria',
  'Kingdom of Belgium': 'Belgium',
  'Republic of Poland': 'Poland',
  'Portuguese Republic': 'Portugal',
  'Republic of Ireland': 'Ireland',
  'Hellenic Republic': 'Greece',
  'Czechia': 'Czech Republic',
  'Republic of Hungary': 'Hungary',
  'Republic of Bulgaria': 'Bulgaria',
  'Republic of Croatia': 'Croatia',
  'Slovak Republic': 'Slovakia',
  'Republic of Slovenia': 'Slovenia',
  'Republic of Lithuania': 'Lithuania',
  'Republic of Latvia': 'Latvia',
  'Republic of Estonia': 'Estonia',
  'Russian Federation': 'Russia',
  'Republic of Belarus': 'Belarus',
  
  // Asia
  'People\'s Republic of China': 'China',
  'PRC': 'China',
  'Republic of India': 'India',
  'Republic of Korea': 'South Korea',
  'Korea': 'South Korea',
  'Kingdom of Thailand': 'Thailand',
  'Socialist Republic of Vietnam': 'Vietnam',
  'Viet Nam': 'Vietnam',
  'Republic of Indonesia': 'Indonesia',
  'Republic of the Philippines': 'Philippines',
  'Republic of Singapore': 'Singapore',
  'Islamic Republic of Pakistan': 'Pakistan',
  'People\'s Republic of Bangladesh': 'Bangladesh',
  'Democratic Socialist Republic of Sri Lanka': 'Sri Lanka',
  'Republic of Turkey': 'Turkey',
  'State of Israel': 'Israel',
  'Kingdom of Saudi Arabia': 'Saudi Arabia',
  'UAE': 'United Arab Emirates',
  
  // Africa
  'Arab Republic of Egypt': 'Egypt',
  'Republic of South Africa': 'South Africa',
  'Federal Republic of Nigeria': 'Nigeria',
  'Republic of Kenya': 'Kenya',
  'Kingdom of Morocco': 'Morocco',
  'People\'s Democratic Republic of Algeria': 'Algeria',
  'Republic of Tunisia': 'Tunisia',
  'Republic of Ghana': 'Ghana',
  'Federal Democratic Republic of Ethiopia': 'Ethiopia',
  
  // South America
  'Federative Republic of Brazil': 'Brazil',
  'Argentine Republic': 'Argentina',
  'Republic of Chile': 'Chile',
  'Republic of Colombia': 'Colombia',
  'Republic of Peru': 'Peru',
  'Bolivarian Republic of Venezuela': 'Venezuela',
  'Oriental Republic of Uruguay': 'Uruguay',
  'Republic of Paraguay': 'Paraguay',
  'Plurinational State of Bolivia': 'Bolivia',
  'Republic of Ecuador': 'Ecuador',
  
  // Oceania
  'Commonwealth of Australia': 'Australia'
};

// Get standardized country name for geography matching
export const getStandardCountryName = (geoName: string): string => {
  return GEOGRAPHY_NAME_MAPPING[geoName] || geoName;
};