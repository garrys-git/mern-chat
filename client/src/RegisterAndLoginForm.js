import React, { useState,useContext } from "react";
import { UserContext } from "./UserContext";
import axios from "axios";

export default function RegisterAndLoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoginOrRegister,setIsLoginOrRegister]=useState("register");
  const {setUsername:setLoggedInUsername,setId}=useContext(UserContext);

  //global.USERAME=username;
  async function handleSubmit(event) {
    event.preventDefault();
    const url=isLoginOrRegister==="register"?"register":"login";
    
      const {data} = await axios.post(url, { username, password });
      
      setLoggedInUsername(username);
      setId(data.id);
      console.log(data);
    
  }
  

  return (
    <div className="bg-blue-50 h-screen flex items-center">
      <form className="w-64 mx-auto mb-12" onSubmit={handleSubmit}>
        <input
          value={username}
          onChange={(event) => {
            setUsername(event.target.value);
          }}
          type="text"
          placeholder="username"
          className="block w-full rounded-sm p-2 mb-2 border"
        />
        <input
          onChange={(event) => {
            setPassword(event.target.value);
          }}
          value={password}
          type="password"
          placeholder="password"
          className="block w-full rounded-sm p-2 mb-2 border"
        />
        <button className="bg-blue-500 text-white block w-full rounded-sm p-2">
         {isLoginOrRegister==="register"?"Register":"Login"}
        </button>
        <div className="text-center mt-2">
        {isLoginOrRegister==="register" && (<div>
          Aldready A member? 
          <button
        onClick={()=>{
          setIsLoginOrRegister("login")
        }}
         >Login Here</button>
        </div>)}
        {isLoginOrRegister==="login" && (<div>
          Aldready A member? 
          <button
        onClick={()=>{
          setIsLoginOrRegister("register")
        }}
         >Register Here</button>
        </div>)}
        </div>
      </form>
    </div>
  );
}
