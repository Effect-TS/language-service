// 3:30

export async function getUserName(userId: string) {
  const user = await fetch(`https://api.example.com/users/${userId}`)
  const userData = await user.json()
  return userData.name
}
