'use client';
import { useEffect, useState } from 'react';
import { Edit3, Save, X, Camera, Mail, User, Trash2, Phone, Building2, CheckCircle, AlertCircle } from 'lucide-react';
import { api } from '@/services/api';
import { UserEditable, UserProfile } from '@/interface/user';
import { toast } from 'react-toastify';
import { useLogout } from '@/components/authentication/logout';
import { useAuthStore } from '@/store/authStore';
import {USER} from '@/interface/authentication';

interface InputFieldProps {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  type?: string;
  placeholder: string;
  isEditing: boolean;
  isEditable?: boolean;
  icon?: React.ReactNode;
}

const InputField: React.FC<InputFieldProps> = ({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  isEditing,
  isEditable = true,
  icon
}) => (
  <div className="space-y-3">
    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
      {icon && <span className="text-blue-600">{icon}</span>}
      {label}
    </label>
    {isEditing && isEditable ? (
      <div className="relative group">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          className="w-full p-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300 bg-white/70 backdrop-blur-sm hover:bg-white/90 group-hover:border-blue-300"
          aria-label={label}
        />
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none"></div>
      </div>
    ) : (
      <div className="relative p-4 bg-gradient-to-r from-gray-50 to-gray-100/50 border border-gray-200 rounded-2xl backdrop-blur-sm">
        <p className="text-gray-800 font-medium">{value || 'Not provided'}</p>
        {!isEditable && (
          <div className="absolute top-2 right-2">
            <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></div>
          </div>
        )}
      </div>
    )}
  </div>
);

const UserProfilePage: React.FC = () => {
  const [userr, setUser] = useState<UserProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedUser, setEditedUser] = useState<UserEditable | null>(null);
  const [imageUploadHover, setImageUploadHover] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const { handleLogout } = useLogout();
  const { user } = useAuthStore();
  const setName = (name: string) => {
    if (user) {
      user.fullname = name;
    }
};
  useEffect(() => {
    const fetchUser = async () => {
      setIsLoading(true);
      try {

        const resp = await api.get("/users/userprofile")
        const data = await resp.message as UserProfile;
        setUser(data);
        setUser(data);
        setEditedUser({
          fullname: data.fullname,
          profileImage: data.profileImage,
          organisation: data.details.organisation,
          contact_no: data.details.contact_no
        });
      } catch (err) {
        setError('Failed to load profile. Please try again later.');
        console.log('Failed to fetch profile:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchUser();
  }, []);

  const handleSave = async () => {
    if (!editedUser) return;
    setIsLoading(true);
    setSaveSuccess(false);
    try {
      const resp = await api.post('/users/userdetails',
        {
          body: editedUser
        }
      );
      if (resp.status === 201) {
        toast.success('Profile updated successfully');
        setName(editedUser.fullname);
      }
      if (userr) {
        const updatedUser: UserProfile = {
          ...userr,
          fullname: editedUser.fullname,
          profileImage: editedUser.profileImage,
          details: {
            organisation: editedUser.organisation,
            contact_no: editedUser.contact_no
          }
        };
        setUser(updatedUser);
      }
      setIsEditing(false);
      setError(null);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError('Failed to save profile. Please try again.');
      console.log('Failed to save profile:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    if (userr) {
      setEditedUser({
        fullname: userr.fullname,
        profileImage: userr.profileImage,
        organisation: userr.details.organisation,
        contact_no: userr.details.contact_no
      });
    }
    setIsEditing(false);
    setError(null);
  };

  const handleInputChange = (field: string, value: string) => {
    setEditedUser((prev) => {
      if (!prev) return null;
      return { ...prev, [field]: value };
    });
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size must be less than 5MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        setEditedUser((prev) => (prev ? { ...prev, profileImage: e.target?.result as string } : prev));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDeleteAccount = async () => {
    const resp = await api.delete('/authentication/delete_account');
    if (resp.status === 201) {
      toast.success('Account deleted successfully');
      handleLogout();
    }
    else {
      toast.error('Failed to delete account. Please try again.');
    }
  };

  if (isLoading && !userr) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-cyan-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-gray-600 text-lg font-medium">Loading your profile...</div>
        </div>
      </div>
    );
  }

  if (error && !userr) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-pink-50">
        <div className="text-center p-8 bg-white/80 backdrop-blur-lg rounded-3xl shadow-xl">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
          <div className="text-red-600 text-lg font-medium">{error}</div>
        </div>
      </div>
    );
  }

  if (!userr || !editedUser) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/50 to-indigo-100/50 relative overflow-hidden">
      {/* Enhanced Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 md:w-96 md:h-96 bg-gradient-to-br from-blue-400/20 via-purple-400/15 to-cyan-400/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 md:w-96 md:h-96 bg-gradient-to-br from-purple-400/15 via-pink-400/10 to-indigo-400/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-60 h-60 bg-gradient-to-br from-cyan-300/10 to-blue-300/10 rounded-full blur-2xl animate-pulse delay-500"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto p-4 sm:p-6 md:p-8">
        {/* Enhanced Header */}
        <div className="mb-8 p-6 sm:p-8 bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 rounded-3xl shadow-2xl text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/90 via-purple-600/90 to-indigo-600/90 backdrop-blur-sm"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-center gap-3 mb-3">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                <User size={24} className="text-white" />
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-wide">
                Welcome, {userr.fullname}
              </h1>
              {userr.is_verified && (
                <CheckCircle size={24} className="text-green-300" />
              )}
            </div>
            <p className="text-blue-100 text-base sm:text-lg font-medium">
              Manage your professional profile with style
            </p>
          </div>
        </div>

        {/* Success Message */}
        {saveSuccess && (
          <div className="mb-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-2xl flex items-center gap-3">
            <CheckCircle size={20} className="text-green-600" />
            <span className="text-green-700 font-medium">Profile updated successfully!</span>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-gradient-to-r from-red-50 to-pink-50 border-2 border-red-200 rounded-2xl flex items-center gap-3">
            <AlertCircle size={20} className="text-red-600" />
            <span className="text-red-700 font-medium">{error}</span>
          </div>
        )}

        {/* Enhanced Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between mb-8 gap-4">
          <h2 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-purple-800 bg-clip-text text-transparent">
            Profile Dashboard
          </h2>
          <div className="flex gap-3">
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="group flex items-center gap-3 px-6 py-3 sm:px-8 sm:py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-2xl hover:shadow-2xl hover:shadow-blue-500/30 transition-all duration-300 font-semibold disabled:opacity-50 transform hover:scale-105"
                disabled={isLoading}
                aria-label="Edit Profile"
              >
                <Edit3 size={20} className="group-hover:rotate-12 transition-transform duration-300" />
                <span>Edit Profile</span>
              </button>
            ) : (
              <>
                <button
                  onClick={handleSave}
                  className="group flex items-center gap-3 px-6 py-3 sm:px-8 sm:py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-2xl hover:shadow-2xl hover:shadow-green-500/30 transition-all duration-300 font-semibold disabled:opacity-50 transform hover:scale-105"
                  disabled={isLoading}
                  aria-label="Save Profile"
                >
                  <Save size={20} className="group-hover:scale-110 transition-transform duration-300" />
                  <span>{isLoading ? 'Saving...' : 'Save Changes'}</span>
                </button>
                <button
                  onClick={handleCancel}
                  className="group flex items-center gap-3 px-6 py-3 sm:px-8 sm:py-4 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-2xl hover:shadow-2xl transition-all duration-300 font-semibold disabled:opacity-50 transform hover:scale-105"
                  disabled={isLoading}
                  aria-label="Cancel Edit"
                >
                  <X size={20} className="group-hover:rotate-90 transition-transform duration-300" />
                  <span>Cancel</span>
                </button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Enhanced Left Profile Card */}
          <div className="lg:col-span-1">
            <div className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/30 p-8 sticky top-4 text-center transform hover:scale-105 transition-all duration-300">
              <div
                className="relative inline-block mb-8"
                onMouseEnter={() => setImageUploadHover(true)}
                onMouseLeave={() => setImageUploadHover(false)}
              >
                <div className="relative w-32 h-32 sm:w-40 sm:h-40 mx-auto">
                  <div className="w-full h-full bg-gradient-to-br from-blue-500 via-purple-500 to-cyan-500 rounded-3xl flex items-center justify-center text-white text-3xl sm:text-4xl font-bold shadow-2xl ring-4 ring-white/50 transform hover:rotate-3 transition-all duration-300">
                    {editedUser.profileImage ? (
                      <img
                        src={editedUser.profileImage}
                        alt="Profile"
                        className="w-full h-full rounded-3xl object-cover"
                      />
                    ) : (
                      userr.fullname.split(' ').map((n) => n[0]).join('')
                    )}
                  </div>
                  {isEditing && (
                    <label
                      className={`absolute inset-0 bg-black/70 rounded-3xl flex items-center justify-center cursor-pointer transition-all duration-300 ${imageUploadHover ? 'opacity-100 scale-105' : 'opacity-0'
                        }`}
                      aria-label="Upload Profile Image"
                    >
                      <Camera size={28} className="text-white drop-shadow-lg animate-bounce" />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              <p className="text-gray-600 text-base sm:text-lg mb-8 font-medium">{userr.details.organisation || 'Organization not set'}</p>

              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-2xl border-2 border-blue-100/50 hover:shadow-lg transition-all duration-300">
                  <Mail size={18} className="text-blue-600" />
                  <span className="text-gray-800 text-sm font-medium break-all">{userr.email}</span>
                </div>

                {userr.details.contact_no && (
                  <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl border-2 border-purple-100/50 hover:shadow-lg transition-all duration-300">
                    <Phone size={18} className="text-purple-600" />
                    <span className="text-gray-800 text-sm font-medium">{userr.details.contact_no}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Enhanced Main Content */}
          <div className="lg:col-span-3">
            <div className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/30 p-8 sm:p-10">
              <div className="space-y-10">
                {/* Enhanced Section Header */}
                <div className="flex items-center gap-4 mb-10">
                  <div className="w-14 h-14 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center shadow-xl transform hover:rotate-12 transition-all duration-300">
                    <User size={24} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-gray-900 to-blue-800 bg-clip-text text-transparent">
                      Personal Information
                    </h3>
                    <p className="text-gray-600 text-lg">Update your profile details</p>
                  </div>
                </div>

                {/* Enhanced Input Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <InputField
                    label="Full Name"
                    value={editedUser.fullname}
                    onChange={(value) => handleInputChange('fullname', value)}
                    placeholder="Enter your full name"
                    isEditing={isEditing}
                    icon={<User size={16} />}
                  />
                  <InputField
                    label="Email Address"
                    value={userr.email}
                    placeholder="Your email address"
                    isEditing={isEditing}
                    isEditable={false}
                    icon={<Mail size={16} />}
                  />
                  <InputField
                    label="Organisation"
                    value={editedUser.organisation}
                    onChange={(value) => handleInputChange('organisation', value)}
                    placeholder="Enter your organisation"
                    isEditing={isEditing}
                    icon={<Building2 size={16} />}
                  />
                  <InputField
                    label="Contact Number"
                    value={editedUser.contact_no}
                    onChange={(value) => handleInputChange('contact_no', value)}
                    placeholder="Enter your contact number"
                    isEditing={isEditing}
                    icon={<Phone size={16} />}
                  />
                </div>

                {/* Enhanced Danger Zone */}
                <div className="p-8 border-3 border-red-200 rounded-3xl bg-gradient-to-r from-red-50/80 to-pink-50/80 backdrop-blur-sm transition-all duration-300 hover:shadow-xl">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-6">
                      <div className="w-16 h-16 bg-gradient-to-r from-red-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-xl transform hover:scale-110 transition-all duration-300">
                        <Trash2 size={24} className="text-white" />
                      </div>
                      <div>
                        <h4 className="text-2xl font-bold text-red-900 mb-2">Delete Account</h4>
                        <p className="text-red-600 text-base">Permanently remove your account and all data</p>
                      </div>
                    </div>
                    <button
                      onClick={handleDeleteAccount}
                      className="group px-6 py-3 sm:px-8 sm:py-4 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-2xl hover:shadow-2xl hover:shadow-red-500/30 transition-all duration-300 font-semibold disabled:opacity-50 transform hover:scale-105"
                      disabled={isLoading}
                      aria-label="Delete Account"
                    >
                      <span className="group-hover:animate-pulse">
                        {isLoading ? 'Deleting...' : 'Delete Account'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfilePage;