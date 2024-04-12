import { createContext, useEffect, useState } from "react";

import axios from "axios";

export const UserContext = createContext({});

export function UserContextProvider({ children }) {
  const [username, setUsername] = useState("");
  const [id, setId] = useState(null);

  useEffect(() => {
    async function fetchData() {
      const info = await axios.get("/profile").then((response) => {
        console.log(response);

        setId(response.data.userData.userId);
        setUsername(response.data.userData.username);
      });
      //console.log(info);
    }
    fetchData();
  }, []);

  return (
    <UserContext.Provider value={{ username, setUsername, id, setId }}>
      {children}
    </UserContext.Provider>
  );
}
