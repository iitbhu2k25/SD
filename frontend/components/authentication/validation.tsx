export  const validateField = (name: string, value: string): string => {
    switch (name) {
      case "fullname":
        return value.length > 3
          ? ""
          : "fullname must be more than 3 characters.";
      case "email": {
        const email = value.trim().toLowerCase();
        const simpleEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return simpleEmailRegex.test(email)
          ? ""
          : "Enter a valid email address.";
      }

      case "password": {
        if (value.length < 8) return "Password must be at least 8 characters.";
        if (!/[!@#$%^&*(),.?":{}|<>[\]\\/~`_\-=+;]/.test(value)) {
          return "Must include at least one symbol.";
        }
        return "";
      }
      default:
        return "";
    }
  };