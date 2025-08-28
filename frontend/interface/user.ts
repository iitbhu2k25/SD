export interface UserProfile {
  fullname: string;
  email: string;
  is_verified: boolean;
  profileImage?: string;
  details: {
    organisation: string;
    contact_no: string;
  };
}

export interface UserEditable {
  fullname: string;
  profileImage?: string;
  organisation: string;
  contact_no: string;
  }