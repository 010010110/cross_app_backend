import { ObjectId } from 'mongodb';

export interface Box {
  _id?: ObjectId;
  parentBoxId?: ObjectId;
  name: string;
  cnpj: string;
  location: {
    type: 'Point';
    coordinates: [number, number];
  };
  geofenceRadius: number;
  contactPhone: string;
  contactEmail: string;
  contactWhatsapp: string;
  contactInstagram: string;
  contactWebsite: string;
  address: string;
  createdAt: Date;
}
