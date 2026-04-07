/**
 * Doctors Configuration
 * Team member data for the practice
 */

export interface Doctor {
  id: string;
  name: string;
  credentials: string;
  title: string;
  specialty: string;
  bio: string;
  image?: string;
}

/**
 * Practice doctors/dentists
 */
export const doctors: Doctor[] = [
  {
    id: 'dr-deepak-bhagat',
    name: 'Dr. Deepak Bhagat',
    credentials: 'DDS',
    title: 'Lead Dentist & Founder',
    specialty: 'General Dentistry & Implantology',
    bio: 'Graduated from New York University in 1987. Over two decades of experience in Woodside, NY. Diplomate of the International Congress of Oral Implantology.',
    image: '/images/doctors/dr-bhagat.jpg',
  },
  {
    id: 'dr-julie-islam',
    name: 'Dr. Julie Islam',
    credentials: 'DMD',
    title: 'Associate Dentist',
    specialty: 'General Dentistry',
    bio: 'Dedicated to providing compassionate, patient-centered dental care with a focus on preventive treatments and patient education.',
    image: '/images/doctors/dr-islam.jpg',
  },
  {
    id: 'dr-lee',
    name: 'Dr. Dorothy Li',
    credentials: 'DDS',
    title: 'Associate Dentist',
    specialty: 'General & Digital Dentistry',
    bio: 'NYU graduate with advanced training in implant surgery, digital dentistry, and Invisalign. Completed residency at Brooklyn Methodist Hospital.',
    image: '/images/doctors/dr-li.jpg',
  },
];
