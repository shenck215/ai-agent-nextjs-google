// components/tools/price-card.tsx
export function PriceCard({ data, location }: { data: any; location: string }) {
	const { price, unit, trend } = data;

	return (
		<div className="my-4 p-5 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
			<div className="flex justify-between items-center mb-3">
				<h3 className="font-bold text-lg text-slate-800">
					{location} 房价速报
				</h3>
				<span
					className={`px-2 py-1 rounded-full text-xs ${
						trend === "stable"
							? "bg-blue-50 text-blue-600"
							: "bg-green-50 text-green-600"
					}`}
				>
					行情：{trend === "stable" ? "平稳" : "上涨"}
				</span>
			</div>
			<div className="flex items-baseline gap-1">
				<span className="text-3xl font-black text-blue-600">
					{price.toLocaleString()}
				</span>
				<span className="text-sm text-slate-500">{unit}</span>
			</div>
			<p className="mt-2 text-xs text-slate-400 italic">
				* 数据由 AI 代理实时检索并生成
			</p>
		</div>
	);
}
